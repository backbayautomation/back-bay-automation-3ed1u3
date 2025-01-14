"""
Enterprise-grade FastAPI middleware for authentication, authorization, and security monitoring.
Implements comprehensive request-level security validation with JWT verification, RBAC,
rate limiting, and multi-tenant isolation.

Version: 1.0.0
"""

import logging
import time
from typing import Dict, List, Optional, Callable
from fastapi import Request, HTTPException  # version: ^0.100.0
from fastapi.middleware.base import BaseHTTPMiddleware  # version: ^0.100.0
from fastapi_limiter import RateLimiter  # version: ^0.1.5
import redis

from ..core.security import verify_token
from ..core.auth import check_permissions
from ..config import settings

# Initialize logger
logger = logging.getLogger(__name__)

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

# Rate limit counts per window
RATE_LIMIT_COUNTS = {
    'default': 1000,  # 1000 requests per minute
    'auth': 5,        # 5 attempts per 5 minutes
    'admin': 10000    # 10000 requests per hour
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
        
        # Initialize rate limiter with Redis backend
        redis_url = settings.SECURITY_CONFIG.get('redis_url', 'redis://localhost:6379/0')
        self.rate_limiter = RateLimiter(
            redis_url=redis_url,
            prefix="rate_limit",
            expire_time=RATE_LIMIT_WINDOWS['default']
        )
        
        # Initialize security logger
        self.logger = logging.getLogger("security")
        
        # Store tenant configuration
        self.tenant_config = tenant_config
        
        # Initialize token cache
        self.token_cache = redis.Redis.from_url(redis_url, db=1)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request with comprehensive security validation.
        
        Args:
            request: FastAPI request object
            call_next: Next middleware handler
            
        Returns:
            Response: Response from next middleware or endpoint
            
        Raises:
            HTTPException: For security violations
        """
        start_time = time.time()
        path = request.url.path
        client_ip = request.client.host

        try:
            # Skip auth for excluded paths
            if path in self.excluded_paths:
                return await call_next(request)

            # Apply rate limiting based on path type
            rate_key = self._get_rate_limit_key(path, client_ip)
            if not await self.rate_limiter.is_allowed(rate_key):
                self.logger.warning(f"Rate limit exceeded for {client_ip} on {path}")
                raise HTTPException(status_code=429, detail="Too many requests")

            # Allow public paths after rate limiting
            if path in self.public_paths:
                return await call_next(request)

            # Verify authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                raise HTTPException(status_code=401, detail="Missing authorization header")

            # Extract and validate token
            token = await self.verify_auth_header(auth_header, request.headers.get('X-Tenant-ID'))
            
            # Get user data from token
            user_data = verify_token(token)
            
            # Check token revocation
            if await self._is_token_revoked(token):
                raise HTTPException(status_code=401, detail="Token has been revoked")

            # Validate permissions
            if not await self.check_path_permissions(
                path,
                user_data,
                request.headers.get('X-Tenant-ID')
            ):
                raise HTTPException(status_code=403, detail="Insufficient permissions")

            # Add user context to request state
            request.state.user = user_data
            
            # Process request
            response = await call_next(request)
            
            # Add security headers
            response.headers.update({
                'X-Frame-Options': 'DENY',
                'X-Content-Type-Options': 'nosniff',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            })

            # Log request metrics
            self._log_request_metrics(request, response, start_time)
            
            return response

        except HTTPException as e:
            self._log_security_event(
                "security_violation",
                {
                    "path": path,
                    "ip": client_ip,
                    "error": str(e),
                    "status_code": e.status_code
                }
            )
            raise

        except Exception as e:
            self.logger.error(f"Middleware error: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Internal security error")

    async def verify_auth_header(self, auth_header: str, tenant_id: Optional[str]) -> str:
        """
        Enhanced verification of Authorization header with security logging.
        
        Args:
            auth_header: Authorization header value
            tenant_id: Optional tenant ID for validation
            
        Returns:
            str: Validated JWT token
            
        Raises:
            HTTPException: If header format is invalid
        """
        try:
            scheme, token = auth_header.split()
            if scheme.lower() != 'bearer':
                raise HTTPException(
                    status_code=401,
                    detail="Invalid authentication scheme"
                )
                
            if not token:
                raise HTTPException(
                    status_code=401,
                    detail="Missing token"
                )

            # Validate token format
            if len(token.split('.')) != 3:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid token format"
                )

            return token

        except ValueError:
            raise HTTPException(
                status_code=401,
                detail="Invalid authorization header format"
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
            user_data: User data from token
            tenant_id: Optional tenant ID for validation
            
        Returns:
            bool: True if user has required permissions
        """
        try:
            # Get required roles for path
            required_roles = self._get_required_roles(path)
            
            # Validate tenant access
            if tenant_id and user_data.get('tenant_id') != tenant_id:
                self.logger.warning(f"Tenant mismatch: {user_data.get('tenant_id')} != {tenant_id}")
                return False

            # Check permissions using auth service
            has_permission = await check_permissions(
                user_data,
                required_roles,
                tenant_id
            )

            if not has_permission:
                self.logger.warning(
                    f"Permission denied for user {user_data.get('sub')} on path {path}"
                )
                
            return has_permission

        except Exception as e:
            self.logger.error(f"Permission check error: {str(e)}", exc_info=True)
            return False

    def _get_rate_limit_key(self, path: str, client_ip: str) -> str:
        """Generate rate limit key based on path type and client IP."""
        if path.startswith('/api/v1/auth/'):
            return f"auth:{client_ip}"
        elif path.startswith('/api/v1/admin/'):
            return f"admin:{client_ip}"
        return f"default:{client_ip}"

    async def _is_token_revoked(self, token: str) -> bool:
        """Check if token has been revoked using Redis cache."""
        return bool(await self.token_cache.get(f"revoked:{token}"))

    def _get_required_roles(self, path: str) -> List[str]:
        """Get required roles for path based on configuration."""
        if path.startswith('/api/v1/admin/'):
            return ['system_admin']
        elif path.startswith('/api/v1/client/'):
            return ['client_admin', 'regular_user']
        return ['regular_user']

    def _log_security_event(self, event_type: str, event_data: Dict) -> None:
        """Log security event with enhanced context."""
        self.logger.info(
            f"Security event: {event_type}",
            extra={
                "event_type": event_type,
                "timestamp": time.time(),
                **event_data
            }
        )

    def _log_request_metrics(self, request: Request, response: Response, start_time: float) -> None:
        """Log request metrics for monitoring."""
        duration = time.time() - start_time
        self.logger.info(
            "Request metrics",
            extra={
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
                "duration": duration,
                "client_ip": request.client.host
            }
        )