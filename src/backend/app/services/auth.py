"""
Authentication service implementing enterprise-grade user authentication, JWT token management,
role-based access control, and security monitoring for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session  # version: ^1.4.0
from fastapi import HTTPException  # version: ^0.100.0
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm  # version: ^0.100.0
from redis import Redis  # version: ^4.5.0

from ..models.user import User
from ..core.security import verify_password, create_access_token, verify_token
from ..db.session import get_db
from ..utils.logging import StructuredLogger

# Initialize OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='api/v1/auth/login', auto_error=True)

# Initialize logger
logger = StructuredLogger(__name__)

# Initialize Redis client for rate limiting and session tracking
redis_client = Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)

async def authenticate_user(
    db: Session,
    email: str,
    password: str,
    ip_address: str,
    tenant_id: Optional[str] = None
) -> Optional[User]:
    """
    Authenticate user with comprehensive security checks and monitoring.

    Args:
        db: Database session
        email: User email
        password: User password
        ip_address: Client IP address
        tenant_id: Optional tenant context

    Returns:
        Optional[User]: Authenticated user or None
    """
    # Check rate limiting for IP and email
    if not _check_auth_rate_limit(ip_address, email):
        logger.log_security_event("auth_rate_limit_exceeded", {
            "ip_address": ip_address,
            "email": email
        })
        raise HTTPException(status_code=429, detail="Too many authentication attempts")

    # Query user with tenant context
    query = db.query(User).filter(User.email == email.lower())
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    user = query.first()

    # Log authentication attempt
    logger.log_auth_attempt({
        "email": email,
        "ip_address": ip_address,
        "tenant_id": tenant_id,
        "success": False
    })

    if not user:
        _increment_failed_attempts(email, ip_address)
        return None

    if not verify_password(password, user.hashed_password):
        _increment_failed_attempts(email, ip_address)
        return None

    # Update user login data
    user.last_login = datetime.utcnow()
    user.last_ip_address = ip_address
    user.failed_login_attempts = 0
    db.commit()

    # Clear failed attempts counter
    _clear_failed_attempts(email, ip_address)

    # Log successful authentication
    logger.log_auth_attempt({
        "email": email,
        "ip_address": ip_address,
        "tenant_id": tenant_id,
        "success": True
    })

    return user

async def get_current_user(
    token: str,
    db: Session,
    tenant_id: Optional[str] = None
) -> User:
    """
    Get current authenticated user with enhanced security validation.

    Args:
        token: JWT access token
        db: Database session
        tenant_id: Optional tenant context

    Returns:
        User: Current authenticated user

    Raises:
        HTTPException: If authentication fails
    """
    try:
        # Verify token and extract payload
        payload = verify_token(token)
        user_id = payload.get("sub")
        token_tenant = payload.get("tenant_id")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token claims")

        # Validate tenant context
        if tenant_id and token_tenant != tenant_id:
            raise HTTPException(status_code=403, detail="Invalid tenant context")

        # Query user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # Verify user status
        if not user.is_active:
            raise HTTPException(status_code=401, detail="User account disabled")

        # Track active session
        _track_active_session(user.id, token)

        return user

    except Exception as e:
        logger.log_security_event("token_validation_failed", {"error": str(e)})
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

async def check_user_permissions(
    user: User,
    required_roles: list[str],
    tenant_id: Optional[str] = None
) -> bool:
    """
    Check user permissions with role hierarchy support.

    Args:
        user: User to check permissions for
        required_roles: List of required role names
        tenant_id: Optional tenant context

    Returns:
        bool: True if user has required permissions
    """
    # Check permission cache
    cache_key = f"permissions:{user.id}:{','.join(required_roles)}"
    cached_result = redis_client.get(cache_key)
    if cached_result is not None:
        return bool(int(cached_result))

    # Validate tenant access
    if tenant_id and not user.validate_tenant_access(tenant_id):
        return False

    # Get role hierarchy
    role_hierarchy = {
        "system_admin": ["system_admin", "client_admin", "regular_user"],
        "client_admin": ["client_admin", "regular_user"],
        "regular_user": ["regular_user"]
    }

    # Check if user's role is in the required roles hierarchy
    allowed_roles = role_hierarchy.get(user.role, [])
    has_permission = any(role in allowed_roles for role in required_roles)

    # Cache result
    redis_client.setex(cache_key, 300, int(has_permission))  # Cache for 5 minutes

    # Log permission check
    logger.log_security_event("permission_check", {
        "user_id": str(user.id),
        "required_roles": required_roles,
        "has_permission": has_permission
    })

    return has_permission

async def create_user_token(
    user: User,
    tenant_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create JWT tokens with enhanced security claims.

    Args:
        user: User to create token for
        tenant_id: Optional tenant context

    Returns:
        Dict[str, Any]: Token response with access and refresh tokens
    """
    # Create token data with security claims
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "tenant_id": tenant_id,
        "ip_address": user.last_ip_address,
        "session_id": str(uuid4())
    }

    # Generate access token
    access_token = create_access_token(
        data=token_data,
        expires_delta=timedelta(minutes=30)
    )

    # Generate refresh token with longer expiry
    refresh_token = create_access_token(
        data={**token_data, "token_type": "refresh"},
        expires_delta=timedelta(days=7)
    )

    # Track active session
    _track_active_session(user.id, access_token)

    # Log token creation
    logger.log_security_event("token_created", {
        "user_id": str(user.id),
        "tenant_id": tenant_id
    })

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": 1800  # 30 minutes in seconds
    }

def _check_auth_rate_limit(ip_address: str, email: str) -> bool:
    """Check rate limits for authentication attempts."""
    ip_key = f"auth_attempts:ip:{ip_address}"
    email_key = f"auth_attempts:email:{email}"
    
    ip_attempts = redis_client.get(ip_key)
    email_attempts = redis_client.get(email_key)

    if ip_attempts and int(ip_attempts) >= 5:  # 5 attempts per minute per IP
        return False
    if email_attempts and int(email_attempts) >= 10:  # 10 attempts per minute per email
        return False

    redis_client.incr(ip_key)
    redis_client.incr(email_key)
    redis_client.expire(ip_key, 60)  # 1 minute expiry
    redis_client.expire(email_key, 60)

    return True

def _increment_failed_attempts(email: str, ip_address: str) -> None:
    """Increment failed authentication attempt counters."""
    ip_key = f"failed_attempts:ip:{ip_address}"
    email_key = f"failed_attempts:email:{email}"

    redis_client.incr(ip_key)
    redis_client.incr(email_key)
    redis_client.expire(ip_key, 3600)  # 1 hour expiry
    redis_client.expire(email_key, 3600)

def _clear_failed_attempts(email: str, ip_address: str) -> None:
    """Clear failed authentication attempt counters."""
    redis_client.delete(f"failed_attempts:ip:{ip_address}")
    redis_client.delete(f"failed_attempts:email:{email}")

def _track_active_session(user_id: str, token: str) -> None:
    """Track active user session."""
    session_key = f"active_sessions:{user_id}"
    redis_client.sadd(session_key, token)
    redis_client.expire(session_key, 1800)  # 30 minutes expiry