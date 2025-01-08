"""
Enterprise-grade FastAPI middleware for authentication, authorization, and security monitoring.
Implements comprehensive request-level security validation with JWT verification, role-based
access control, rate limiting, and multi-tenant isolation.

Version: 1.0.0
"""

import time
import logging
from typing import Dict, List, Optional, Callable
from datetime import datetime
from uuid import UUID

from fastapi import Request, HTTPException
from fastapi.middleware.base import BaseHTTPMiddleware  # version: ^0.100.0
from fastapi_limiter import RateLimiter  # version: ^0.1.5

from ..core.security import verify_token
from ..core.auth import check_permissions
from ..config import settings
from ..utils.logging import StructuredLogger

# Initialize security logger
security_logger = StructuredLogger("auth_middleware")

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

# Rate limit windows (in seconds)
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
    """
    Enterprise-grade FastAPI middleware implementing comprehensive authentication,
    authorization, and security monitoring with multi-tenant isolation.
    """

    def __init__(self, app, tenant_config: Dict = None):
        """
        Initialize auth middleware with enhanced security configuration.

        Args:
            app: FastAPI application instance
            tenant_config: Multi-tenant configuration settings
        """
        super().__init__(app)
        self.excluded_paths = set(EXCLUDED_PATHS)
        self.public_paths = set(PUBLIC_PATHS)
        self.tenant_config = tenant_config or {}
        self.logger = security_logger
        
        # Initialize rate limiters
        self.rate_limiters = {
            'default': RateLimiter(
                key_prefix="rate_limit:default",
                max_requests=RATE_LIMIT_COUNTS['default'],
                window_seconds=RATE_LIMIT_WINDOWS['default']
            ),
            'auth': RateLimiter(
                key_prefix="rate_limit:auth",
                max_requests=RATE_LIMIT_COUNTS['auth'],
                window_seconds=RATE_LIMIT_WINDOWS['auth']
            ),
            'admin': RateLimiter(
                key_prefix="rate_limit:admin",
                max_requests=RATE_LIMIT_COUNTS['admin'],
                window_seconds=RATE_LIMIT_WINDOWS['admin']
            )
        }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request with comprehensive security validation.

        Args:
            request: FastAPI request object
            call_next: Next middleware handler

        Returns:
            Response: Response from next middleware or endpoint

        Raises:
            HTTPException: For various security validation failures
        """
        start_time = time.time()
        path = request.url.path
        client_ip = request.client.host
        tenant_id = request.headers.get("X-Tenant-ID")

        try:
            # Check if path is excluded from auth
            if path in self.excluded_paths:
                return await call_next(request)

            # Apply rate limiting based on path type
            rate_limiter = self._get_rate_limiter(path)
            if not await rate_limiter.is_allowed(f"{client_ip}:{path}"):
                self.logger.log_security_event("rate_limit_exceeded", {
                    "path": path,
                    "ip": client_ip,
                    "tenant_id": tenant_id
                })
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded"
                )

            # Allow public paths after rate limiting
            if path in self.public_paths:
                return await call_next(request)

            # Verify and extract authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                raise HTTPException(
                    status_code=401,
                    detail="Missing authorization header",
                    headers={"WWW-Authenticate": "Bearer"}
                )

            # Validate JWT token
            token = await self.verify_auth_header(auth_header, tenant_id)
            
            # Extract user data from token
            user_data = verify_token(token)
            
            # Validate tenant context
            token_tenant = user_data.get("tenant_id")
            if tenant_id and token_tenant != tenant_id:
                self.logger.log_security_event("invalid_tenant_context", {
                    "token_tenant": token_tenant,
                    "request_tenant": tenant_id,
                    "user_id": user_data.get("sub")
                })
                raise HTTPException(
                    status_code=403,
                    detail="Invalid tenant context"
                )

            # Check permissions for path
            if not await self.check_path_permissions(path, user_data, tenant_id):
                self.logger.log_security_event("permission_denied", {
                    "path": path,
                    "user_id": user_data.get("sub"),
                    "tenant_id": tenant_id
                })
                raise HTTPException(
                    status_code=403,
                    detail="Permission denied"
                )

            # Add user and tenant context to request state
            request.state.user = user_data
            request.state.tenant_id = tenant_id

            # Process request
            response = await call_next(request)

            # Log request metrics
            duration = time.time() - start_time
            self.logger.log_metric("request_duration", duration, {
                "path": path,
                "tenant_id": tenant_id,
                "status_code": response.status_code
            })

            return response

        except HTTPException as e:
            # Re-raise HTTP exceptions with security context
            self.logger.log_security_event("security_error", {
                "error": str(e),
                "status_code": e.status_code,
                "path": path,
                "ip": client_ip,
                "tenant_id": tenant_id
            })
            raise

        except Exception as e:
            # Log unexpected errors
            self.logger.log_security_event("critical_error", {
                "error": str(e),
                "path": path,
                "ip": client_ip,
                "tenant_id": tenant_id
            })
            raise HTTPException(
                status_code=500,
                detail="Internal security error"
            )

    async def verify_auth_header(self, auth_header: str, tenant_id: Optional[str]) -> str:
        """
        Enhanced verification of Authorization header with security logging.

        Args:
            auth_header: Authorization header value
            tenant_id: Optional tenant identifier

        Returns:
            str: Validated JWT token

        Raises:
            HTTPException: If header validation fails
        """
        try:
            # Validate header format
            if not auth_header.startswith("Bearer "):
                raise ValueError("Invalid authorization header format")

            token = auth_header.split(" ")[1]
            if not token:
                raise ValueError("Empty token")

            return token

        except Exception as e:
            self.logger.log_security_event("invalid_auth_header", {
                "error": str(e),
                "tenant_id": tenant_id
            })
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization header",
                headers={"WWW-Authenticate": "Bearer"}
            )

    async def check_path_permissions(
        self,
        path: str,
        user_data: Dict,
        tenant_id: Optional[str]
    ) -> bool:
        """
        Advanced permission checking with role hierarchy and tenant isolation.

        Args:
            path: Request path
            user_data: User data from JWT token
            tenant_id: Optional tenant identifier

        Returns:
            bool: True if user has required permissions
        """
        try:
            # Get required roles for path
            required_roles = self._get_required_roles(path)
            
            # Check permissions using auth module
            return await check_permissions(
                user=user_data,
                required_roles=required_roles,
                tenant_id=tenant_id
            )

        except Exception as e:
            self.logger.log_security_event("permission_check_error", {
                "error": str(e),
                "path": path,
                "user_id": user_data.get("sub"),
                "tenant_id": tenant_id
            })
            return False

    def _get_rate_limiter(self, path: str) -> RateLimiter:
        """Get appropriate rate limiter based on path."""
        if path.startswith("/api/v1/auth/"):
            return self.rate_limiters['auth']
        elif path.startswith("/api/v1/admin/"):
            return self.rate_limiters['admin']
        return self.rate_limiters['default']

    def _get_required_roles(self, path: str) -> List[str]:
        """Get required roles for path based on configuration."""
        # Add path-based role requirements logic here
        if path.startswith("/api/v1/admin/"):
            return ["system_admin"]
        elif path.startswith("/api/v1/clients/"):
            return ["client_admin", "system_admin"]
        return ["regular_user", "client_admin", "system_admin"]