"""
FastAPI v1 API router initialization with comprehensive error handling, security middleware,
and request validation for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Request  # version: ^0.103.0
from fastapi.responses import JSONResponse  # version: ^0.103.0
from fastapi_limiter import RateLimiter  # version: ^0.1.5
from uuid import uuid4
import logging
from datetime import datetime
from typing import Dict, Any

from .router import router as api_router

# Initialize logger
logger = logging.getLogger(__name__)

# API version prefix
API_V1_STR = "/api/v1"

# Initialize main v1 router
router = APIRouter(prefix=API_V1_STR)

# Security headers based on technical specifications
SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
}

def configure_error_handlers() -> None:
    """Configure global error handlers and middleware for the v1 API router."""
    
    @router.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Enhanced global handler for HTTP exceptions with correlation ID and logging."""
        correlation_id = str(uuid4())
        
        error_data = {
            "status_code": exc.status_code,
            "detail": exc.detail,
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "path": str(request.url),
            "method": request.method
        }

        # Extract tenant context if available
        tenant_id = request.headers.get("X-Tenant-ID")
        if tenant_id:
            error_data["tenant_id"] = tenant_id

        # Log error with context
        logger.error(
            f"HTTP {exc.status_code} error: {exc.detail}",
            extra={
                "correlation_id": correlation_id,
                "tenant_id": tenant_id,
                "error_data": error_data
            }
        )

        return JSONResponse(
            status_code=exc.status_code,
            content=error_data,
            headers=SECURITY_HEADERS
        )

    @router.middleware("http")
    async def add_security_headers(request: Request, call_next):
        """Add security headers to all API responses."""
        response = await call_next(request)
        
        # Add security headers
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
            
        return response

    @router.middleware("http")
    async def request_validation_middleware(request: Request, call_next):
        """Validate request headers and apply rate limiting."""
        # Validate tenant context
        if not request.headers.get("X-Tenant-ID") and request.url.path != f"{API_V1_STR}/health":
            raise HTTPException(
                status_code=400,
                detail="Missing tenant context"
            )

        # Apply rate limiting
        rate_limiter = RateLimiter(
            times=1000,  # 1000 requests per hour per client
            hours=1
        )
        await rate_limiter(request)

        return await call_next(request)

# Include API router and configure error handlers
router.include_router(api_router)
configure_error_handlers()

# Export configured router and constants
__all__ = ["router", "API_V1_STR"]