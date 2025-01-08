"""
Authentication endpoints implementing OAuth 2.0 and JWT-based authentication with enhanced security,
multi-tenant support, and comprehensive monitoring for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from ....core.auth import authenticate_user, get_current_active_user
from ....core.security import create_access_token, RateLimiter
from ....schemas.user import User
from ....db.session import get_db
from ....utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/auth", tags=["auth"])

# Initialize security components
rate_limiter = RateLimiter(max_attempts=5, window_seconds=300)
security_logger = StructuredLogger("auth")

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
        Dict containing access token and user information

    Raises:
        HTTPException: For authentication failures or rate limit exceeded
    """
    try:
        # Check rate limiting
        client_ip = request.client.host if request else "unknown"
        if not rate_limiter.check_rate_limit(f"login:{client_ip}"):
            security_logger.log_security_event("rate_limit_exceeded", {
                "ip": client_ip,
                "email": form_data.username
            })
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please try again later."
            )

        # Extract tenant context from headers
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            raise HTTPException(
                status_code=400,
                detail="Tenant context is required"
            )

        # Authenticate user
        user = await authenticate_user(
            db=db,
            email=form_data.username,
            password=form_data.password,
            tenant_id=tenant_id,
            client_ip=client_ip
        )

        if not user:
            rate_limiter.increment_counter(f"login:{client_ip}")
            security_logger.log_security_event("login_failed", {
                "ip": client_ip,
                "email": form_data.username,
                "tenant_id": tenant_id
            })
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password"
            )

        # Generate access token
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "email": user.email,
                "tenant_id": tenant_id,
                "roles": user.roles
            },
            expires_delta=access_token_expires
        )

        # Log successful login
        security_logger.log_security_event("login_successful", {
            "user_id": str(user.id),
            "email": user.email,
            "tenant_id": tenant_id,
            "ip": client_ip
        })

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "roles": user.roles,
                "tenant_id": tenant_id
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        security_logger.log_security_event("login_error", {
            "error": str(e),
            "ip": client_ip if request else "unknown"
        })
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
    Secure logout with token invalidation and session cleanup.

    Args:
        current_user: Currently authenticated user
        request: FastAPI request object

    Returns:
        Dict containing success message

    Raises:
        HTTPException: For logout failures
    """
    try:
        client_ip = request.client.host if request else "unknown"
        
        # Add current token to blacklist
        token = request.headers.get("Authorization", "").split(" ")[1]
        if token:
            await redis_client.sadd("token_blacklist", token)
            await redis_client.expire("token_blacklist", 86400)  # 24 hours

        # Log logout event
        security_logger.log_security_event("logout_successful", {
            "user_id": str(current_user.id),
            "email": current_user.email,
            "tenant_id": current_user.tenant_id,
            "ip": client_ip
        })

        return {"message": "Successfully logged out"}

    except Exception as e:
        security_logger.log_security_event("logout_error", {
            "error": str(e),
            "user_id": str(current_user.id),
            "ip": client_ip if request else "unknown"
        })
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
    Get current user details with security validation.

    Args:
        current_user: Currently authenticated user
        request: FastAPI request object

    Returns:
        User object with masked sensitive data

    Raises:
        HTTPException: For unauthorized access or validation failures
    """
    try:
        client_ip = request.client.host if request else "unknown"

        # Log access event
        security_logger.log_security_event("user_profile_access", {
            "user_id": str(current_user.id),
            "tenant_id": current_user.tenant_id,
            "ip": client_ip
        })

        # Return user with masked sensitive data
        return User.from_orm(current_user)

    except Exception as e:
        security_logger.log_security_event("profile_access_error", {
            "error": str(e),
            "user_id": str(current_user.id),
            "ip": client_ip if request else "unknown"
        })
        raise HTTPException(
            status_code=500,
            detail="Error retrieving user profile"
        )