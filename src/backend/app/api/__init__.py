"""
Root API package initialization module for the AI-powered Product Catalog Search System.
Configures and exports the main FastAPI router with versioned endpoints, security middleware,
request tracing, and comprehensive error handling.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Request  # version: ^0.103.0
from fastapi.responses import JSONResponse  # version: ^0.103.0
from fastapi.middleware.cors import CORSMiddleware  # version: ^0.103.0
from fastapi.middleware.gzip import GZipMiddleware  # version: ^0.103.0
import logging
from datetime import datetime
from uuid import uuid4
from typing import Dict, Any

from .v1 import router as v1_router, API_V1_STR
from ..core.security import authenticate_request, validate_api_key

# Initialize router with prefix and tags
router = APIRouter(prefix='/api', tags=['api'])

# Initialize logger
logger = logging.getLogger(__name__)

# API version
API_VERSION = 'v1'

# Security headers
SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
    'Cache-Control': 'no-store, no-cache, must-revalidate'
}

# CORS configuration
CORS_ORIGINS = ['https://*.example.com']
REQUEST_TIMEOUT_SECONDS = 30

def configure_router() -> None:
    """
    Configure the main API router with versioned endpoints, security middleware,
    and global settings.
    """
    # Add CORS middleware
    router.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Correlation-ID"]
    )

    # Add GZip compression
    router.add_middleware(GZipMiddleware, minimum_size=1000)

    # Include versioned routers
    router.include_router(v1_router, prefix=API_V1_STR)

    logger.info(
        "API router configured",
        extra={
            'api_version': API_VERSION,
            'cors_origins': CORS_ORIGINS,
            'security_headers': list(SECURITY_HEADERS.keys())
        }
    )

@router.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Enhanced global exception handler with correlation ID tracking and HAL links.

    Args:
        request: FastAPI request object
        exc: HTTP exception instance

    Returns:
        JSONResponse: Structured error response with correlation ID
    """
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid4()))
    tenant_id = request.headers.get("X-Tenant-ID")

    # Log error with context
    logger.error(
        f"HTTP {exc.status_code} error occurred",
        extra={
            'correlation_id': correlation_id,
            'tenant_id': tenant_id,
            'path': request.url.path,
            'method': request.method,
            'error': exc.detail,
            'status_code': exc.status_code
        }
    )

    error_response = {
        "status": "error",
        "code": exc.status_code,
        "message": exc.detail,
        "correlation_id": correlation_id,
        "timestamp": datetime.utcnow().isoformat(),
        "path": request.url.path,
        "_links": {
            "self": {"href": str(request.url)},
            "docs": {"href": "/docs"},
            "home": {"href": "/"}
        }
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

@router.get('/health')
async def health_check() -> Dict[str, Any]:
    """
    API health check endpoint for monitoring.

    Returns:
        Dict containing health status and version information
    """
    return {
        "status": "healthy",
        "version": API_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "_links": {
            "self": {"href": "/api/health"},
            "docs": {"href": "/docs"}
        }
    }

# Configure router with middleware and endpoints
configure_router()

# Export router and version
__all__ = ["router", "API_VERSION"]