"""
FastAPI v1 API router initialization with comprehensive error handling, security middleware,
and request validation for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Request  # version: ^0.103.0
from fastapi.responses import JSONResponse  # version: ^0.103.0
from fastapi_limiter import RateLimiter  # version: ^0.1.5
from uuid import uuid4  # version: ^3.11
import logging
from datetime import datetime

from .router import router as api_router

# API version prefix
API_V1_STR = "/api/v1"

# Initialize main v1 router
router = APIRouter(prefix=API_V1_STR)

# Security headers configuration
SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
    'Cache-Control': 'no-store, no-cache, must-revalidate'
}

# Configure logging
logger = logging.getLogger(__name__)

def configure_error_handlers():
    """Configure global error handlers and middleware for the v1 API router."""
    
    @router.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Enhanced global handler for HTTP exceptions with correlation ID and logging."""
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid4()))
        tenant_id = request.headers.get("X-Tenant-ID")

        # Log error with context
        logger.error(
            f"HTTP {exc.status_code} error occurred",
            extra={
                "correlation_id": correlation_id,
                "tenant_id": tenant_id,
                "path": request.url.path,
                "method": request.method,
                "error": exc.detail,
                "status_code": exc.status_code
            }
        )

        error_response = {
            "status": "error",
            "code": exc.status_code,
            "message": exc.detail,
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path
        }

        if tenant_id:
            error_response["tenant_id"] = tenant_id

        return JSONResponse(
            status_code=exc.status_code,
            content=error_response,
            headers={
                "X-Correlation-ID": correlation_id,
                **SECURITY_HEADERS
            }
        )

    @router.middleware("http")
    async def add_security_headers(request: Request, call_next):
        """Add security headers to all API responses."""
        response = await call_next(request)
        
        # Add security headers
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value

        # Add correlation ID if not present
        if "X-Correlation-ID" not in response.headers:
            response.headers["X-Correlation-ID"] = request.headers.get(
                "X-Correlation-ID", 
                str(uuid4())
            )

        return response

    @router.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        """Implement rate limiting per client."""
        client_ip = request.client.host
        rate_limiter = RateLimiter(
            key_prefix=f"ratelimit:{client_ip}",
            max_requests=1000,
            expire=3600
        )

        is_allowed = await rate_limiter.is_allowed(client_ip)
        if not is_allowed:
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "client_ip": client_ip,
                    "path": request.url.path
                }
            )
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later."
            )

        return await call_next(request)

# Configure error handlers and middleware
configure_error_handlers()

# Include API router
router.include_router(api_router)

# Export router and API version prefix
__all__ = ["router", "API_V1_STR"]