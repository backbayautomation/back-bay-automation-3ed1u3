"""
Authentication service implementing enterprise-grade user authentication, JWT token management,
role-based access control, and security monitoring for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from redis import Redis  # version: ^4.5.0

from ..models.user import User
from ..core.security import verify_password, create_access_token, verify_token
from ..db.session import get_db
from ..utils.logging import StructuredLogger

# Initialize OAuth2 scheme with token URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='api/v1/auth/login', auto_error=True)

# Initialize structured logger
logger = StructuredLogger(__name__)

# Initialize Redis client for rate limiting and token management
redis_client = Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)

# Constants for rate limiting
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 900  # 15 minutes in seconds
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds
MAX_REQUESTS_PER_WINDOW = 1000

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
        email: User's email address
        password: User's password
        ip_address: Client IP address
        tenant_id: Optional tenant context

    Returns:
        Optional[User]: Authenticated user or None
    """
    try:
        # Check rate limit for IP and email
        if not await track_authentication_attempt(email, ip_address, False):
            logger.log_security_event("rate_limit_exceeded", {
                "email": email,
                "ip_address": ip_address
            })
            raise HTTPException(status_code=429, detail="Too many login attempts")

        # Query user with tenant context
        user_query = db.query(User).filter(User.email == email)
        if tenant_id:
            user_query = user_query.filter(User.tenant_id == tenant_id)
        user = user_query.first()

        # Log authentication attempt
        logger.log_auth_attempt({
            "email": email,
            "ip_address": ip_address,
            "tenant_id": tenant_id,
            "success": bool(user)
        })

        if not user:
            return None

        # Verify password
        if not verify_password(password, user.hashed_password):
            user.failed_login_attempts += 1
            user.last_ip_address = ip_address
            db.commit()
            return None

        # Update user login data
        user.last_login = datetime.utcnow()
        user.failed_login_attempts = 0
        user.last_ip_address = ip_address
        db.commit()

        # Log successful authentication
        logger.log_security_event("authentication_success", {
            "user_id": str(user.id),
            "email": email,
            "ip_address": ip_address
        })

        return user

    except Exception as e:
        logger.log_security_event("authentication_error", {
            "error": str(e),
            "email": email,
            "ip_address": ip_address
        })
        raise

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
        # Verify token and claims
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
            raise HTTPException(status_code=404, detail="User not found")

        # Verify user status
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User account disabled")

        return user

    except Exception as e:
        logger.log_security_event("token_validation_error", {
            "error": str(e),
            "token_prefix": token[:8] if token else None
        })
        raise

async def check_user_permissions(
    user: User,
    required_roles: list[str],
    tenant_id: Optional[str] = None
) -> bool:
    """
    Check if user has required permissions with role hierarchy support.

    Args:
        user: User to check
        required_roles: List of required role names
        tenant_id: Optional tenant context

    Returns:
        bool: True if user has required permissions
    """
    try:
        # Validate tenant context
        if tenant_id and user.tenant_id != tenant_id:
            return False

        # System admin has all permissions
        if user.role == "system_admin":
            return True

        # Check role hierarchy
        role_hierarchy = {
            "client_admin": ["regular_user"],
            "regular_user": []
        }

        user_roles = [user.role] + role_hierarchy.get(user.role, [])
        has_permission = any(role in user_roles for role in required_roles)

        # Log permission check
        logger.log_security_event("permission_check", {
            "user_id": str(user.id),
            "required_roles": required_roles,
            "user_role": user.role,
            "has_permission": has_permission
        })

        return has_permission

    except Exception as e:
        logger.log_security_event("permission_check_error", {
            "error": str(e),
            "user_id": str(user.id)
        })
        return False

async def create_user_token(
    user: User,
    tenant_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create JWT access token with enhanced security claims.

    Args:
        user: User to create token for
        tenant_id: Optional tenant context

    Returns:
        Dict[str, Any]: Token response with access and refresh tokens
    """
    try:
        # Create token data with security claims
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "tenant_id": tenant_id or user.tenant_id,
            "ip_address": user.last_ip_address
        }

        # Generate access token
        access_token = create_access_token(token_data)

        # Log token creation
        logger.log_security_event("token_created", {
            "user_id": str(user.id),
            "token_type": "access"
        })

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "role": user.role
            }
        }

    except Exception as e:
        logger.log_security_event("token_creation_error", {
            "error": str(e),
            "user_id": str(user.id)
        })
        raise

async def track_authentication_attempt(
    email: str,
    ip_address: str,
    success: bool
) -> bool:
    """
    Track and rate limit authentication attempts.

    Args:
        email: User's email
        ip_address: Client IP address
        success: Whether the attempt was successful

    Returns:
        bool: True if attempt is allowed, False if rate limited
    """
    try:
        # Check IP-based rate limit
        ip_key = f"auth_attempts:ip:{ip_address}"
        ip_attempts = int(redis_client.get(ip_key) or 0)

        if ip_attempts >= MAX_LOGIN_ATTEMPTS:
            return False

        # Check email-based rate limit
        email_key = f"auth_attempts:email:{email}"
        email_attempts = int(redis_client.get(email_key) or 0)

        if email_attempts >= MAX_LOGIN_ATTEMPTS:
            return False

        # Update attempt counters
        pipe = redis_client.pipeline()
        if not success:
            pipe.incr(ip_key)
            pipe.incr(email_key)
            pipe.expire(ip_key, LOCKOUT_DURATION)
            pipe.expire(email_key, LOCKOUT_DURATION)
        else:
            pipe.delete(ip_key)
            pipe.delete(email_key)
        pipe.execute()

        return True

    except Exception as e:
        logger.log_security_event("rate_limit_error", {
            "error": str(e),
            "email": email,
            "ip_address": ip_address
        })
        return False