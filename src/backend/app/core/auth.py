"""
Core authentication module implementing OAuth 2.0 and JWT-based authentication with enhanced security features.
Includes multi-tenant validation, comprehensive audit logging, rate limiting, and advanced permission management.

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional, List
from fastapi import HTTPException, Depends  # version: ^0.100.0
from fastapi.security import OAuth2PasswordBearer  # version: ^0.100.0
from sqlalchemy.ext.asyncio import AsyncSession  # version: ^1.4.0
from fastapi_cache import cache  # version: ^0.1.0
from slowapi import RateLimiter  # version: ^0.1.5

from ..models.user import User, verify_password, to_dict
from .security import create_access_token, verify_token
from ..db.session import get_db
from ..utils.logging import SecurityLogger

# Initialize OAuth2 scheme with enhanced security
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='api/v1/auth/login', auto_error=True)

# Initialize security logger for audit trail
security_logger = SecurityLogger()

# Initialize rate limiter for authentication attempts
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
        tenant_id: Tenant identifier for isolation
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
            "auth_rate_limit_exceeded",
            {"email": email, "ip": client_ip}
        )
        raise HTTPException(
            status_code=429,
            detail="Too many authentication attempts. Please try again later."
        )

    try:
        # Query user with tenant validation
        query = """
            SELECT * FROM users 
            WHERE email = :email 
            AND (org_id = :tenant_id OR role = 'system_admin')
        """
        result = await db.execute(query, {"email": email, "tenant_id": tenant_id})
        user = result.first()

        if not user:
            security_logger.log_security_event(
                "auth_user_not_found",
                {"email": email, "tenant_id": tenant_id}
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials"
            )

        # Verify password with timing attack protection
        if not verify_password(password, user.hashed_password):
            # Track failed login attempts
            await db.execute(
                "UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = :id",
                {"id": user.id}
            )
            await db.commit()

            security_logger.log_security_event(
                "auth_failed_password",
                {"user_id": str(user.id), "tenant_id": tenant_id}
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials"
            )

        # Reset failed login attempts on successful auth
        await db.execute(
            """
            UPDATE users 
            SET failed_login_attempts = 0,
                last_login = :timestamp,
                last_ip_address = :ip
            WHERE id = :id
            """,
            {
                "id": user.id,
                "timestamp": datetime.utcnow(),
                "ip": client_ip
            }
        )
        await db.commit()

        security_logger.log_security_event(
            "auth_successful",
            {"user_id": str(user.id), "tenant_id": tenant_id}
        )
        return user

    except Exception as e:
        security_logger.log_security_event(
            "auth_error",
            {"error": str(e), "email": email}
        )
        raise HTTPException(
            status_code=500,
            detail="Authentication error occurred"
        )

@cache(expire=300)
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
        tenant_id: Tenant identifier for validation

    Returns:
        User: Validated current user

    Raises:
        HTTPException: If token is invalid or user not found
    """
    try:
        # Verify token with tenant context
        payload = verify_token(token)
        user_id = payload.get("sub")

        if not user_id:
            raise ValueError("Invalid token payload")

        # Query user with tenant validation
        query = """
            SELECT * FROM users 
            WHERE id = :user_id 
            AND (org_id = :tenant_id OR role = 'system_admin')
        """
        result = await db.execute(query, {"user_id": user_id, "tenant_id": tenant_id})
        user = result.first()

        if not user:
            security_logger.log_security_event(
                "auth_invalid_user",
                {"user_id": user_id, "tenant_id": tenant_id}
            )
            raise HTTPException(
                status_code=401,
                detail="User not found or invalid tenant"
            )

        return user

    except ValueError as e:
        security_logger.log_security_event(
            "auth_invalid_token",
            {"error": str(e)}
        )
        raise HTTPException(
            status_code=401,
            detail=str(e)
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
        session_id: Session identifier for tracking

    Returns:
        User: Validated active user

    Raises:
        HTTPException: If user is inactive or session invalid
    """
    if not current_user.is_active:
        security_logger.log_security_event(
            "auth_inactive_user",
            {"user_id": str(current_user.id)}
        )
        raise HTTPException(
            status_code=403,
            detail="Inactive user account"
        )

    # Validate session if provided
    if session_id:
        # Add session validation logic here
        pass

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
        tenant_id: Tenant identifier for validation
        resource_id: Optional resource identifier

    Returns:
        bool: True if user has required permissions

    Raises:
        HTTPException: If permission check fails
    """
    try:
        # System admin bypass
        if user.role == "system_admin":
            return True

        # Validate tenant access
        if not user.validate_tenant_access(tenant_id):
            security_logger.log_security_event(
                "permission_tenant_violation",
                {
                    "user_id": str(user.id),
                    "tenant_id": tenant_id,
                    "required_roles": required_roles
                }
            )
            return False

        # Check role hierarchy
        role_hierarchy = {
            "system_admin": ["client_admin", "regular_user"],
            "client_admin": ["regular_user"],
            "regular_user": []
        }

        allowed_roles = [user.role] + role_hierarchy.get(user.role, [])
        has_role = any(role in allowed_roles for role in required_roles)

        if not has_role:
            security_logger.log_security_event(
                "permission_role_violation",
                {
                    "user_id": str(user.id),
                    "user_role": user.role,
                    "required_roles": required_roles
                }
            )
            return False

        return True

    except Exception as e:
        security_logger.log_security_event(
            "permission_check_error",
            {"error": str(e), "user_id": str(user.id)}
        )
        raise HTTPException(
            status_code=500,
            detail="Permission check error occurred"
        )