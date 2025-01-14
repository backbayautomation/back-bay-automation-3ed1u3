"""
Authentication endpoints implementing OAuth 2.0 and JWT-based authentication flows
with enhanced security features, multi-tenant support, and comprehensive monitoring.

Version: 1.0.0
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from redis import Redis

from ....core.auth import authenticate_user, get_current_active_user
from ....core.security import create_access_token, RateLimiter
from ....schemas.user import User
from ....db.session import get_db
from ....utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/auth", tags=["auth"])

# Initialize structured logger for security events
logger = StructuredLogger(__name__)

# Initialize rate limiter with configured thresholds
rate_limiter = RateLimiter(max_attempts=5, window_seconds=300)

# Initialize Redis for token blacklist
redis_client = Redis(
    host="localhost",  # Configure from settings in production
    port=6379,
    db=0,
    decode_responses=True
)

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    request: Request = None
) -> Dict[str, Any]:
    """
    Authenticate user and generate JWT token with enhanced security and tenant isolation.
    
    Args:
        form_data: OAuth2 password form containing credentials
        db: Database session with tenant context
        request: FastAPI request object for IP tracking
        
    Returns:
        dict: Access token, type and user context
        
    Raises:
        HTTPException: For authentication failures or rate limit exceeded
    """
    try:
        # Extract tenant context from headers
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            raise HTTPException(
                status_code=400,
                detail="Tenant context required"
            )

        # Check rate limits
        client_ip = request.client.host
        if not rate_limiter.check_rate_limit(f"login:{client_ip}"):
            logger.log_security_event(
                "rate_limit_exceeded",
                {
                    "ip": client_ip,
                    "email": form_data.username,
                    "tenant_id": tenant_id
                }
            )
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please try again later."
            )

        # Authenticate user with tenant validation
        user = await authenticate_user(
            db=db,
            email=form_data.username,
            password=form_data.password,
            tenant_id=tenant_id,
            client_ip=client_ip
        )

        if not user:
            rate_limiter.increment_counter(f"login:{client_ip}")
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials"
            )

        # Generate access token with tenant context
        access_token_expires = timedelta(
            minutes=30  # Configure from settings
        )
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "tenant_id": tenant_id,
                "roles": user.roles
            },
            expires_delta=access_token_expires
        )

        # Log successful authentication
        logger.log_security_event(
            "login_successful",
            {
                "user_id": str(user.id),
                "tenant_id": tenant_id,
                "ip": client_ip
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "roles": user.roles,
                "tenant_id": tenant_id
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.log_security_event(
            "login_error",
            {
                "error": str(e),
                "email": form_data.username,
                "tenant_id": tenant_id
            }
        )
        raise HTTPException(
            status_code=500,
            detail="Authentication service error"
        )

@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_active_user),
    request: Request = None
) -> Dict[str, str]:
    """
    Secure logout with token invalidation and session cleanup.
    
    Args:
        current_user: Currently authenticated user
        request: FastAPI request object for context
        
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: For logout failures
    """
    try:
        # Extract token from authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
            # Add token to blacklist with expiry
            redis_client.setex(
                f"token_blacklist:{token}",
                timedelta(hours=24),  # Match token expiry
                "true"
            )

        # Log logout event
        logger.log_security_event(
            "logout_successful",
            {
                "user_id": str(current_user.id),
                "tenant_id": str(current_user.tenant_id),
                "ip": request.client.host
            }
        )

        return {"message": "Successfully logged out"}

    except Exception as e:
        logger.log_security_event(
            "logout_error",
            {
                "error": str(e),
                "user_id": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=500,
            detail="Logout failed"
        )

@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_active_user),
    request: Request = None
) -> User:
    """
    Get current user details with security validation.
    
    Args:
        current_user: Currently authenticated user
        request: FastAPI request object for context
        
    Returns:
        User: Masked user details
        
    Raises:
        HTTPException: For unauthorized access
    """
    try:
        # Log access event
        logger.log_security_event(
            "profile_access",
            {
                "user_id": str(current_user.id),
                "tenant_id": str(current_user.tenant_id),
                "ip": request.client.host
            }
        )

        # Return masked user data
        return User(
            id=current_user.id,
            email=current_user.email,
            tenant_id=current_user.tenant_id,
            roles=current_user.roles,
            is_active=current_user.is_active,
            created_at=current_user.created_at,
            updated_at=current_user.updated_at,
            last_login=current_user.last_login
        )

    except Exception as e:
        logger.log_security_event(
            "profile_access_error",
            {
                "error": str(e),
                "user_id": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve user profile"
        )