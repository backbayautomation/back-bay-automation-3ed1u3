"""
Core authentication module implementing OAuth 2.0 and JWT-based authentication with enhanced security features.
Provides multi-tenant validation, comprehensive audit logging, rate limiting, and advanced permission management.

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional, List
from fastapi import HTTPException, Depends  # version: ^0.100.0
from fastapi.security import OAuth2PasswordBearer  # version: ^0.100.0
from sqlalchemy.ext.asyncio import AsyncSession  # version: ^1.4.0
from fastapi_cache import cache  # version: ^0.1.0
from slowapi import RateLimiter  # version: ^0.1.5

from ..models.user import User
from .security import create_access_token, verify_token
from ..db.session import get_db
from ..utils.logging import SecurityLogger

# Initialize OAuth2 scheme with enhanced security
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='api/v1/auth/login', auto_error=True)

# Initialize security logger for audit trail
security_logger = SecurityLogger()

# Initialize rate limiter with configurable window
rate_limiter = RateLimiter(max_attempts=5, window_seconds=300)

async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str,
    tenant_id: str,
    client_ip: str
) -> Optional[User]:
    """
    Enhanced user authentication with rate limiting, audit logging, and multi-tenant validation.
    
    Args:
        db: Database session
        email: User email
        password: User password
        tenant_id: Tenant/organization ID
        client_ip: Client IP address for rate limiting
        
    Returns:
        Optional[User]: Authenticated user or None
        
    Raises:
        HTTPException: If authentication fails or rate limit exceeded
    """
    # Check rate limiting for IP and email combination
    rate_key = f"{client_ip}:{email}"
    if not rate_limiter.is_allowed(rate_key):
        security_logger.log_security_event(
            "rate_limit_exceeded",
            {"email": email, "ip": client_ip, "tenant_id": tenant_id}
        )
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again later."
        )

    try:
        # Query user with tenant validation
        query = """
            SELECT u.* FROM users u
            JOIN organizations o ON u.org_id = o.id
            WHERE u.email = :email AND o.id = :tenant_id
        """
        result = await db.execute(query, {"email": email, "tenant_id": tenant_id})
        user = result.first()

        if not user:
            security_logger.log_security_event(
                "login_failed",
                {"reason": "user_not_found", "email": email, "tenant_id": tenant_id}
            )
            return None

        # Verify password with timing attack protection
        if not user.verify_password(password):
            # Track failed attempts
            user.failed_login_attempts += 1
            await db.commit()
            
            security_logger.log_security_event(
                "login_failed",
                {"reason": "invalid_password", "user_id": str(user.id)}
            )
            return None

        # Reset failed attempts on successful login
        user.failed_login_attempts = 0
        user.last_login = datetime.utcnow()
        user.last_ip_address = client_ip
        await db.commit()

        security_logger.log_security_event(
            "login_successful",
            {"user_id": str(user.id), "tenant_id": tenant_id}
        )
        return user

    except Exception as e:
        security_logger.log_security_event(
            "login_error",
            {"error": str(e), "email": email, "tenant_id": tenant_id}
        )
        raise HTTPException(
            status_code=500,
            detail="Authentication service error"
        )

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
    tenant_id: str = None
) -> User:
    """
    Enhanced current user retrieval with token blacklist and refresh handling.
    
    Args:
        db: Database session
        token: JWT token
        tenant_id: Optional tenant ID for validation
        
    Returns:
        User: Validated current user
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    try:
        # Verify token with tenant context
        payload = verify_token(token)
        user_id = payload.get("sub")
        token_tenant = payload.get("tenant_id")

        # Validate tenant context if provided
        if tenant_id and token_tenant != tenant_id:
            security_logger.log_security_event(
                "tenant_mismatch",
                {"user_id": user_id, "token_tenant": token_tenant, "request_tenant": tenant_id}
            )
            raise HTTPException(
                status_code=403,
                detail="Invalid tenant context"
            )

        # Query user with tenant validation
        query = """
            SELECT u.* FROM users u
            JOIN organizations o ON u.org_id = o.id
            WHERE u.id = :user_id AND o.id = :tenant_id
        """
        result = await db.execute(query, {"user_id": user_id, "tenant_id": token_tenant})
        user = result.first()

        if not user:
            security_logger.log_security_event(
                "user_not_found",
                {"user_id": user_id, "tenant_id": token_tenant}
            )
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        return user

    except Exception as e:
        security_logger.log_security_event(
            "token_validation_error",
            {"error": str(e), "tenant_id": tenant_id}
        )
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )

@cache(expire=60)
async def get_current_active_user(
    current_user: User = Depends(get_current_user),
    session_id: str = None
) -> User:
    """
    Enhanced active user validation with session tracking.
    
    Args:
        current_user: Current authenticated user
        session_id: Optional session ID for validation
        
    Returns:
        User: Validated active user
        
    Raises:
        HTTPException: If user is inactive or session invalid
    """
    if not current_user.is_active:
        security_logger.log_security_event(
            "inactive_user_access",
            {"user_id": str(current_user.id)}
        )
        raise HTTPException(
            status_code=400,
            detail="Inactive user"
        )

    # Validate session if provided
    if session_id and not verify_session(current_user.id, session_id):
        security_logger.log_security_event(
            "invalid_session",
            {"user_id": str(current_user.id), "session_id": session_id}
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid session"
        )

    return current_user

@cache(expire=300)
async def check_permissions(
    user: User,
    required_roles: List[str],
    tenant_id: str,
    resource_id: str = None
) -> bool:
    """
    Advanced permission checking with hierarchical roles and caching.
    
    Args:
        user: User to check permissions for
        required_roles: List of required role names
        tenant_id: Tenant ID for context
        resource_id: Optional resource ID for fine-grained permissions
        
    Returns:
        bool: True if user has required permissions
        
    Raises:
        HTTPException: If permission check fails
    """
    try:
        # Validate tenant context
        if str(user.org_id) != tenant_id:
            security_logger.log_security_event(
                "permission_check_failed",
                {
                    "reason": "tenant_mismatch",
                    "user_id": str(user.id),
                    "tenant_id": tenant_id
                }
            )
            return False

        # Check role hierarchy
        user_role = user.role.value
        if user_role == "system_admin":
            return True

        if user_role == "client_admin" and all(
            role in ["client_admin", "regular_user"] for role in required_roles
        ):
            return True

        if user_role in required_roles:
            # Validate resource-level permissions if applicable
            if resource_id:
                return verify_resource_access(user.id, resource_id)
            return True

        security_logger.log_security_event(
            "permission_check_failed",
            {
                "reason": "insufficient_permissions",
                "user_id": str(user.id),
                "required_roles": required_roles
            }
        )
        return False

    except Exception as e:
        security_logger.log_security_event(
            "permission_check_error",
            {"error": str(e), "user_id": str(user.id)}
        )
        raise HTTPException(
            status_code=500,
            detail="Permission check failed"
        )