"""
Authentication service implementing enterprise-grade user authentication, JWT token management,
role-based access control, and security monitoring for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session  # version: ^1.4.0
from fastapi import HTTPException  # version: ^0.100.0
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm  # version: ^0.100.0
from redis import Redis  # version: ^4.5.0

from ..models.user import User
from ..core.security import verify_password, create_access_token, verify_token
from ..db.session import get_db
from ..utils.logging import StructuredLogger

# Initialize security components
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='api/v1/auth/login', auto_error=True)
logger = StructuredLogger(__name__)
redis_client = Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)

# Security constants
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 900  # 15 minutes
RATE_LIMIT_KEY_PREFIX = "rate_limit:"
FAILED_ATTEMPTS_KEY_PREFIX = "failed_attempts:"

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
        
    Raises:
        HTTPException: For authentication failures or rate limiting
    """
    # Check rate limiting
    if not await track_authentication_attempt(email, ip_address, success=False):
        logger.log_security_event("rate_limit_exceeded", {
            "email": email,
            "ip_address": ip_address,
            "tenant_id": tenant_id
        })
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again later."
        )

    # Query user with tenant context
    user_query = db.query(User).filter(User.email == email.lower())
    if tenant_id:
        user_query = user_query.filter(User.tenant_id == tenant_id)
    user = user_query.first()

    # Log authentication attempt
    logger.log_auth_attempt({
        "email": email,
        "ip_address": ip_address,
        "tenant_id": tenant_id,
        "success": False
    })

    # Handle invalid user
    if not user:
        await track_authentication_attempt(email, ip_address, success=False)
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    # Verify password
    if not verify_password(password, user.hashed_password):
        await track_authentication_attempt(email, ip_address, success=False)
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    # Update user login data
    user.last_login = datetime.utcnow()
    user.last_ip_address = ip_address
    user.failed_login_attempts = 0
    db.commit()

    # Clear failed attempts and log success
    await track_authentication_attempt(email, ip_address, success=True)
    logger.log_security_event("login_success", {
        "user_id": str(user.id),
        "email": email,
        "ip_address": ip_address,
        "tenant_id": tenant_id
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
        HTTPException: For invalid or expired tokens
    """
    try:
        # Verify token and extract claims
        payload = verify_token(token)
        user_id = payload.get("sub")
        token_tenant = payload.get("tenant_id")

        # Validate tenant context
        if tenant_id and token_tenant != tenant_id:
            raise HTTPException(
                status_code=403,
                detail="Invalid tenant context"
            )

        # Query user with tenant context
        user_query = db.query(User).filter(User.id == user_id)
        if tenant_id:
            user_query = user_query.filter(User.tenant_id == tenant_id)
        user = user_query.first()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=401,
                detail="User not found or inactive"
            )

        return user

    except Exception as e:
        logger.log_security_event("token_validation_error", {
            "error": str(e),
            "tenant_id": tenant_id
        })
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )

async def check_user_permissions(
    user: User,
    required_roles: list[str],
    tenant_id: Optional[str] = None
) -> bool:
    """
    Check if user has required permissions with role hierarchy support.
    
    Args:
        user: User to check permissions for
        required_roles: List of required role names
        tenant_id: Optional tenant context
        
    Returns:
        bool: True if user has required permissions
    """
    try:
        # Validate tenant context
        if tenant_id and user.tenant_id != tenant_id:
            logger.log_security_event("permission_check_failed", {
                "user_id": str(user.id),
                "required_roles": required_roles,
                "reason": "tenant_mismatch"
            })
            return False

        # Get role hierarchy
        role_hierarchy = {
            "system_admin": ["system_admin", "client_admin", "regular_user"],
            "client_admin": ["client_admin", "regular_user"],
            "regular_user": ["regular_user"]
        }

        # Check if user's role hierarchy includes any required role
        user_roles = role_hierarchy.get(user.role.value, [])
        has_permission = any(role in user_roles for role in required_roles)

        # Log permission check
        logger.log_security_event("permission_check", {
            "user_id": str(user.id),
            "required_roles": required_roles,
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
    Create JWT tokens with enhanced security claims.
    
    Args:
        user: User to create token for
        tenant_id: Optional tenant context
        
    Returns:
        dict: Token response with access and refresh tokens
    """
    try:
        # Create token data with security claims
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "tenant_id": tenant_id or user.tenant_id,
            "ip": user.last_ip_address
        }

        # Generate tokens
        access_token = create_access_token(token_data)
        refresh_token = create_access_token(
            token_data,
            expires_delta=timedelta(days=7)
        )

        # Log token creation
        logger.log_security_event("token_created", {
            "user_id": str(user.id),
            "tenant_id": tenant_id
        })

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }

    except Exception as e:
        logger.log_security_event("token_creation_error", {
            "error": str(e),
            "user_id": str(user.id)
        })
        raise HTTPException(
            status_code=500,
            detail="Error creating authentication token"
        )

async def track_authentication_attempt(
    email: str,
    ip_address: str,
    success: bool
) -> bool:
    """
    Track and rate limit authentication attempts with Redis.
    
    Args:
        email: User email
        ip_address: Client IP address
        success: Whether the attempt was successful
        
    Returns:
        bool: True if attempt is allowed, False if rate limited
    """
    try:
        # Get rate limit keys
        email_key = f"{RATE_LIMIT_KEY_PREFIX}email:{email}"
        ip_key = f"{RATE_LIMIT_KEY_PREFIX}ip:{ip_address}"
        
        if not success:
            # Increment failed attempts
            email_attempts = redis_client.incr(email_key)
            ip_attempts = redis_client.incr(ip_key)
            
            # Set expiry if not exists
            redis_client.expire(email_key, LOCKOUT_DURATION)
            redis_client.expire(ip_key, LOCKOUT_DURATION)
            
            # Check rate limits
            if email_attempts > MAX_LOGIN_ATTEMPTS or ip_attempts > MAX_LOGIN_ATTEMPTS:
                logger.log_security_event("login_rate_limit", {
                    "email": email,
                    "ip_address": ip_address,
                    "email_attempts": email_attempts,
                    "ip_attempts": ip_attempts
                })
                return False
        else:
            # Clear rate limits on success
            redis_client.delete(email_key, ip_key)
            
        return True

    except Exception as e:
        logger.log_security_event("rate_limit_error", {
            "error": str(e),
            "email": email
        })
        return False