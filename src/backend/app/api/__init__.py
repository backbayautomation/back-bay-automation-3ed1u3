"""
Root API package initialization module for the AI-powered Product Catalog Search System.
Configures and exports the main FastAPI router with versioned endpoints, comprehensive security
middleware, request tracing, and error handling.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Request  # version: ^0.103.0
from fastapi.responses import JSONResponse  # version: ^0.103.0
from fastapi.middleware.cors import CORSMiddleware  # version: ^0.103.0
from fastapi.middleware.gzip import GZipMiddleware  # version: ^0.103.0
from datetime import datetime
import logging
from uuid import uuid4

from .v1 import router as v1_router
from ..core.security import authenticate_request, validate_api_key

# Initialize router with prefix and tags
router = APIRouter(prefix='/api', tags=['api'])

# API version identifier
API_VERSION = 'v1'

# Security configuration
CORS_ORIGINS = ['https://*.example.com']
REQUEST_TIMEOUT_SECONDS = 30

# Initialize logger
logger = logging.getLogger(__name__)

def configure_router():
    """Configure main API router with security middleware and global settings."""
    
    # Configure CORS middleware with secure defaults
    router.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Version"],
        max_age=3600
    )

    # Add GZip compression
    router.add_middleware(GZipMiddleware, minimum_size=1000)

    # Include versioned routers
    router.include_router(v1_router, prefix=f"/v1")

@router.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Enhanced global exception handler with correlation ID tracking."""
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid4()))
    
    # Log error with context
    logger.error(
        "HTTP error occurred",
        extra={
            'correlation_id': correlation_id,
            'status_code': exc.status_code,
            'detail': exc.detail,
            'path': request.url.path,
            'method': request.method,
            'client_ip': request.client.host
        }
    )

    # Format error response with HAL links
    error_response = {
        'status': 'error',
        'code': exc.status_code,
        'message': exc.detail,
        'correlation_id': correlation_id,
        'timestamp': datetime.utcnow().isoformat(),
        'path': request.url.path,
        '_links': {
            'self': {'href': str(request.url)},
            'docs': {'href': '/api/docs'}
        }
    }

    # Add security headers
    headers = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'X-Correlation-ID': correlation_id,
        **(exc.headers or {})
    }

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response,
        headers=headers
    )

@router.get('/health')
async def health_check() -> JSONResponse:
    """API health check endpoint for monitoring."""
    try:
        # Return health status with version info
        return JSONResponse(
            content={
                'status': 'healthy',
                'version': API_VERSION,
                'timestamp': datetime.utcnow().isoformat(),
                '_links': {
                    'self': {'href': '/api/health'},
                    'docs': {'href': '/api/docs'}
                }
            },
            headers={
                'X-Version': API_VERSION,
                'Cache-Control': 'no-store'
            }
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error during health check"
        )

# Configure router with all middleware and endpoints
configure_router()

# Export configured router and version
__all__ = ['router', 'API_VERSION']