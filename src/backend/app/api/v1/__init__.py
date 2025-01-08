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
from typing import Dict, Any

from .router import router as v1_router

# API version prefix
API_V1_STR = "/api/v1"

# Initialize main router
router = APIRouter(prefix=API_V1_STR)

# Security headers based on technical specifications
SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
    'Cache-Control': 'no-store, no-cache, must-revalidate'
}

# Initialize logger
logger = logging.getLogger(__name__)

def configure_error_handlers() -> None:
    """Configure global error handlers and middleware for the v1 API router."""
    
    @router.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Enhanced global handler for HTTP exceptions with correlation ID and logging."""
        correlation_id = str(uuid4())
        
        # Log error with context
        logger.error(
            "HTTP error occurred",
            extra={
                'correlation_id': correlation_id,
                'status_code': exc.status_code,
                'detail': exc.detail,
                'path': request.url.path,
                'method': request.method,
                'client_ip': request.client.host,
                'tenant_id': request.headers.get('X-Tenant-ID', 'unknown')
            }
        )

        # Format error response
        error_response = {
            'status': 'error',
            'code': exc.status_code,
            'message': exc.detail,
            'correlation_id': correlation_id,
            'timestamp': datetime.utcnow().isoformat(),
            'path': request.url.path
        }

        # Add security headers to response
        headers = {**SECURITY_HEADERS, **(exc.headers or {})}
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response,
            headers=headers
        )

    @router.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Global handler for unhandled exceptions with secure error messages."""
        correlation_id = str(uuid4())
        
        # Log error with full details
        logger.error(
            f"Unhandled exception: {str(exc)}",
            extra={
                'correlation_id': correlation_id,
                'path': request.url.path,
                'method': request.method
            },
            exc_info=True
        )

        # Return sanitized error response
        error_response = {
            'status': 'error',
            'code': 500,
            'message': 'An internal server error occurred',
            'correlation_id': correlation_id,
            'timestamp': datetime.utcnow().isoformat(),
            'path': request.url.path
        }

        return JSONResponse(
            status_code=500,
            content=error_response,
            headers=SECURITY_HEADERS
        )

def add_security_headers(response: JSONResponse) -> JSONResponse:
    """Add security headers to all API responses."""
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    return response

# Configure rate limiting based on technical specifications
rate_limiter = RateLimiter(
    key_func=lambda request: f"{request.client.host}:{request.headers.get('X-Tenant-ID', 'unknown')}",
    max_requests=1000,
    time_window=3600  # 1 hour
)

# Configure middleware
@router.middleware("http")
async def add_security_middleware(request: Request, call_next):
    """Add security middleware with headers and request validation."""
    # Add correlation ID
    request.state.correlation_id = str(uuid4())
    
    # Apply rate limiting
    await rate_limiter.check(request)
    
    # Process request
    response = await call_next(request)
    
    # Add security headers
    return add_security_headers(response)

# Include v1 router with all endpoints
router.include_router(v1_router)

# Configure error handlers
configure_error_handlers()

# Export configured router and constants
__all__ = ['router', 'API_V1_STR']