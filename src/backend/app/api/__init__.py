"""
Root API package initialization module for the AI-powered Product Catalog Search System.
Configures and exports the main FastAPI router with versioned endpoints, security middleware,
and comprehensive monitoring.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Request  # version: ^0.103.0
from fastapi.responses import JSONResponse  # version: ^0.103.0
from fastapi.middleware.cors import CORSMiddleware  # version: ^0.103.0
from fastapi.middleware.gzip import GZipMiddleware  # version: ^0.103.0
import logging
from datetime import datetime
from typing import Dict, Any

from .v1 import router as v1_router
from ..core.security import authenticate_request, validate_api_key
from ..utils.logging import get_correlation_id

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize main router with prefix and tags
router = APIRouter(prefix='/api', tags=['api'])

# Global constants
API_VERSION = 'v1'
CORS_ORIGINS = ['https://*.example.com']
REQUEST_TIMEOUT_SECONDS = 30

# Security headers based on technical specifications
SECURITY_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
}

def configure_router() -> None:
    """Configure main API router with comprehensive security and monitoring."""
    
    # Configure CORS middleware with secure defaults
    router.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Correlation-ID"]
    )

    # Add GZip compression
    router.add_middleware(GZipMiddleware, minimum_size=1000)

    # Configure authentication middleware
    @router.middleware("http")
    async def auth_middleware(request: Request, call_next):
        """Authenticate requests with tenant isolation."""
        try:
            # Skip auth for health check
            if request.url.path.endswith("/health"):
                return await call_next(request)

            # Validate API key for service-to-service calls
            api_key = request.headers.get("X-API-Key")
            if api_key:
                if not await validate_api_key(api_key):
                    raise HTTPException(status_code=401, detail="Invalid API key")
            else:
                # Authenticate user request
                await authenticate_request(request)

            return await call_next(request)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Authentication failed: {str(e)}", exc_info=True)
            raise HTTPException(status_code=401, detail="Authentication failed")

    # Configure request validation middleware
    @router.middleware("http")
    async def validation_middleware(request: Request, call_next):
        """Validate request headers and tenant context."""
        if not request.url.path.endswith("/health"):
            tenant_id = request.headers.get("X-Tenant-ID")
            if not tenant_id:
                raise HTTPException(
                    status_code=400,
                    detail="Missing tenant context"
                )

        return await call_next(request)

    # Include v1 router
    router.include_router(v1_router, prefix=f"/v1")

@router.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Enhanced exception handler with correlation ID tracking."""
    correlation_id = get_correlation_id()
    
    error_data = {
        "status_code": exc.status_code,
        "detail": exc.detail,
        "correlation_id": correlation_id,
        "timestamp": datetime.utcnow().isoformat(),
        "path": str(request.url),
        "method": request.method,
        "_links": {
            "self": {"href": str(request.url)},
            "docs": {"href": "/api/docs"}
        }
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

@router.get('/health')
async def health_check() -> Dict[str, Any]:
    """API health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "version": API_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "_links": {
            "self": {"href": "/api/health"},
            "docs": {"href": "/api/docs"}
        }
    }

# Configure router on module import
configure_router()

# Export configured router and version
__all__ = ["router", "API_VERSION"]