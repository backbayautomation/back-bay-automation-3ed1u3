"""
Authentication endpoints implementing OAuth 2.0 and JWT-based authentication flows with enhanced security features,
multi-tenant support, and comprehensive monitoring for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request  # version: ^0.100.0
from fastapi.security import OAuth2PasswordRequestForm  # version: ^0.100.0
from sqlalchemy.ext.asyncio import AsyncSession  # version: ^1.4.0
import logging  # version: latest
from redis import Redis  # version: ^4.5.0

from ....core.auth import authenticate_user, get_current_active_user
from ....core.security import create_access_token, RateLimiter
from ....schemas.user import User
from ....db.session import get_db

# Initialize router with prefix and tags
router = APIRouter(prefix="/auth", tags=["auth"])

# Initialize rate limiter for login attempts
rate_limiter = RateLimiter(max_attempts=5, window_seconds=300)

# Initialize Redis client for token blacklist
redis_client = Redis(
    host="localhost",
    port=6379,
    db=0,
    decode_responses=True
)

# Configure logger
logger = logging.getLogger(__name__)

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    request: Request = None
) -> Dict[str, Any]:
    """
    Authenticate user and generate JWT token with enhanced security features.

    Args:
        form_data: OAuth2 password form data
        db: Database session
        request: FastAPI request object

    Returns:
        dict: Access token and user information

    Raises:
        HTTPException: If authentication fails or rate limit exceeded
    """
    try:
        # Get client IP and tenant context
        client_ip = request.client.host
        tenant_id = request.headers.get("X-Tenant-ID")

        # Check rate limit
        if not await rate_limiter.check_rate_limit(f"login:{client_ip}"):
            logger.warning(
                "Login rate limit exceeded",
                extra={
                    "ip_address": client_ip,
                    "email": form_data.username
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
            await rate_limiter.increment_counter(f"login:{client_ip}")
            raise HTTPException(
                status_code=401,
                detail="Invalid credentials"
            )

        # Generate access token
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "tenant_id": str(user.tenant_id),
                "roles": user.roles
            },
            expires_delta=access_token_expires
        )

        # Log successful login
        logger.info(
            "User logged in successfully",
            extra={
                "user_id": str(user.id),
                "tenant_id": str(user.tenant_id),
                "ip_address": client_ip
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "roles": user.roles
            }
        }

    except Exception as e:
        logger.error(
            "Login error",
            extra={
                "error": str(e),
                "ip_address": client_ip,
                "email": form_data.username
            }
        )
        raise HTTPException(
            status_code=500,
            detail="Authentication error occurred"
        )

@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_active_user),
    request: Request = None
) -> Dict[str, str]:
    """
    Logout user and invalidate current token.

    Args:
        current_user: Currently authenticated user
        request: FastAPI request object

    Returns:
        dict: Success message

    Raises:
        HTTPException: If logout fails
    """
    try:
        # Get token from authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
            # Add token to blacklist with expiry
            redis_client.sadd("token_blacklist", token)
            redis_client.expire(token, 3600)  # 1 hour expiry

        # Log logout event
        logger.info(
            "User logged out successfully",
            extra={
                "user_id": str(current_user.id),
                "tenant_id": str(current_user.tenant_id)
            }
        )

        return {"message": "Successfully logged out"}

    except Exception as e:
        logger.error(
            "Logout error",
            extra={
                "error": str(e),
                "user_id": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=500,
            detail="Logout error occurred"
        )

@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_active_user),
    request: Request = None
) -> User:
    """
    Get current user information with security validation.

    Args:
        current_user: Currently authenticated user
        request: FastAPI request object

    Returns:
        User: Current user details

    Raises:
        HTTPException: If user validation fails
    """
    try:
        # Validate tenant context
        tenant_id = request.headers.get("X-Tenant-ID")
        if tenant_id and str(current_user.tenant_id) != tenant_id:
            raise HTTPException(
                status_code=403,
                detail="Invalid tenant context"
            )

        # Log access event
        logger.info(
            "User profile accessed",
            extra={
                "user_id": str(current_user.id),
                "tenant_id": str(current_user.tenant_id)
            }
        )

        # Return masked user data
        return User(
            id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            roles=current_user.roles,
            tenant_id=current_user.tenant_id,
            is_active=current_user.is_active,
            created_at=current_user.created_at,
            updated_at=current_user.updated_at
        )

    except Exception as e:
        logger.error(
            "Profile access error",
            extra={
                "error": str(e),
                "user_id": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=500,
            detail="Error retrieving user profile"
        )