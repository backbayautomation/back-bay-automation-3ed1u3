"""
Enterprise-grade FastAPI middleware for authentication, authorization, and security monitoring.
Implements comprehensive request-level security validation with JWT verification, RBAC,
rate limiting, and multi-tenant isolation.

Version: 1.0.0
"""

import logging
import time
from typing import Dict, List, Optional
from fastapi import Request, HTTPException  # version: ^0.100.0
from fastapi.middleware.base import BaseHTTPMiddleware  # version: ^0.100.0
from fastapi_limiter import RateLimiter  # version: ^0.1.5
import redis

from ..core.security import verify_token
from ..core.auth import check_permissions
from ..config import settings
from ..utils.logging import StructuredLogger

# Initialize structured logger
logger = StructuredLogger(__name__)

# Paths excluded from authentication
EXCLUDED_PATHS = [
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/docs',
    '/redoc',
    '/openapi.json'
]

# Public paths requiring rate limiting but no auth
PUBLIC_PATHS = [
    '/api/v1/health',
    '/api/v1/metrics'
]

# Rate limit windows in seconds
RATE_LIMIT_WINDOWS = {
    'default': 60,    # 1 minute
    'auth': 300,      # 5 minutes
    'admin': 3600     # 1 hour
}

# Rate limit request counts
RATE_LIMIT_COUNTS = {
    'default': 1000,  # 1000 requests per minute
    'auth': 5,        # 5 auth attempts per 5 minutes
    'admin': 10000    # 10000 admin requests per hour
}

class AuthMiddleware(BaseHTTPMiddleware):
    """Enterprise-grade FastAPI middleware for comprehensive authentication and security."""

    def __init__(self, app, tenant_config: Dict):
        """
        Initialize auth middleware with enhanced security configuration.

        Args:
            app: FastAPI application instance
            tenant_config: Multi-tenant configuration dictionary
        """
        super().__init__(app)
        self.excluded_paths = set(EXCLUDED_PATHS)
        self.public_paths = set(PUBLIC_PATHS)
        self.tenant_config = tenant_config

        # Initialize Redis for rate limiting
        self.redis_client = redis.Redis(
            host=settings.REDIS_CONFIG["host"],
            port=settings.REDIS_CONFIG["port"],
            db=0,
            decode_responses=True
        )

        # Initialize rate limiter
        self.rate_limiter = RateLimiter(
            redis_client=self.redis_client,
            prefix="rate_limit",
            default_limits=RATE_LIMIT_COUNTS["default"]
        )

        logger.info(
            "Auth middleware initialized",
            extra={
                "excluded_paths": len(self.excluded_paths),
                "public_paths": len(self.public_paths)
            }
        )

    async def dispatch(self, request: Request, call_next):
        """
        Process each request with comprehensive security validation.

        Args:
            request: FastAPI request object
            call_next: Next middleware handler

        Returns:
            Response from next middleware or endpoint

        Raises:
            HTTPException: For various security violations
        """
        start_time = time.time()
        path = request.url.path
        client_ip = request.client.host

        try:
            # Skip auth for excluded paths
            if path in self.excluded_paths:
                return await call_next(request)

            # Apply rate limiting for all paths
            rate_key = self._get_rate_limit_key(path, client_ip)
            if not await self._check_rate_limit(rate_key):
                logger.warning(
                    "Rate limit exceeded",
                    extra={"path": path, "ip": client_ip}
                )
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests"
                )

            # Allow public paths after rate limiting
            if path in self.public_paths:
                return await call_next(request)

            # Verify authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                raise HTTPException(
                    status_code=401,
                    detail="Missing authorization header"
                )

            # Extract and validate token
            token = await self.verify_auth_header(auth_header)
            payload = verify_token(token)

            # Extract tenant context
            tenant_id = request.headers.get("X-Tenant-ID")
            if not tenant_id and payload.get("tenant_id"):
                tenant_id = payload["tenant_id"]

            # Validate permissions
            if not await check_permissions(
                user=payload,
                required_roles=self._get_required_roles(path),
                tenant_id=tenant_id
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Insufficient permissions"
                )

            # Add user and tenant context to request state
            request.state.user = payload
            request.state.tenant_id = tenant_id

            # Process request
            response = await call_next(request)

            # Log successful request
            duration = time.time() - start_time
            logger.info(
                "Request processed successfully",
                extra={
                    "path": path,
                    "duration": duration,
                    "user_id": payload.get("sub"),
                    "tenant_id": tenant_id
                }
            )

            return response

        except HTTPException as e:
            # Log security exceptions
            logger.warning(
                "Security violation",
                extra={
                    "path": path,
                    "error": str(e),
                    "status_code": e.status_code
                }
            )
            raise

        except Exception as e:
            # Log unexpected errors
            logger.error(
                "Middleware error",
                extra={
                    "path": path,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
            raise HTTPException(
                status_code=500,
                detail="Internal server error"
            )

    async def verify_auth_header(self, auth_header: str) -> str:
        """
        Enhanced verification of Authorization header with security logging.

        Args:
            auth_header: Authorization header value

        Returns:
            str: Validated JWT token

        Raises:
            HTTPException: If header format or token is invalid
        """
        try:
            scheme, token = auth_header.split()
            if scheme.lower() != "bearer":
                raise ValueError("Invalid authorization scheme")
            return token
        except ValueError as e:
            logger.warning(
                "Invalid auth header",
                extra={"error": str(e)}
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization header format"
            )

    def _get_rate_limit_key(self, path: str, client_ip: str) -> str:
        """
        Generate rate limit key based on path and client IP.

        Args:
            path: Request path
            client_ip: Client IP address

        Returns:
            str: Rate limit key
        """
        if path.startswith("/api/v1/auth"):
            return f"auth:{client_ip}"
        elif path.startswith("/api/v1/admin"):
            return f"admin:{client_ip}"
        return f"default:{client_ip}"

    async def _check_rate_limit(self, key: str) -> bool:
        """
        Check rate limit for given key.

        Args:
            key: Rate limit key

        Returns:
            bool: True if within limit, False if exceeded
        """
        try:
            window = RATE_LIMIT_WINDOWS.get(
                key.split(":")[0],
                RATE_LIMIT_WINDOWS["default"]
            )
            max_requests = RATE_LIMIT_COUNTS.get(
                key.split(":")[0],
                RATE_LIMIT_COUNTS["default"]
            )

            count = await self.redis_client.incr(key)
            if count == 1:
                await self.redis_client.expire(key, window)

            return count <= max_requests

        except Exception as e:
            logger.error(
                "Rate limit check failed",
                extra={"error": str(e)}
            )
            # Fail open to prevent blocking legitimate requests
            return True

    def _get_required_roles(self, path: str) -> List[str]:
        """
        Determine required roles based on request path.

        Args:
            path: Request path

        Returns:
            List[str]: List of required role names
        """
        if path.startswith("/api/v1/admin"):
            return ["system_admin"]
        elif path.startswith("/api/v1/clients"):
            return ["system_admin", "client_admin"]
        return ["system_admin", "client_admin", "regular_user"]