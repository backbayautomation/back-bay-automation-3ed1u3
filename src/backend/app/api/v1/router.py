"""
Main FastAPI router configuration for the AI-powered Product Catalog Search System API v1.
Implements comprehensive routing with advanced middleware, security controls, and monitoring.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Request, status  # version: ^0.103.0
from fastapi.responses import JSONResponse  # version: ^0.103.0
from fastapi.middleware.security import SecurityMiddleware  # version: ^0.103.0
from slowapi import SlowApiMiddleware  # version: ^0.1.8
from prometheus_fastapi_instrumentator import MetricsMiddleware  # version: ^5.9.1
from loguru import logger  # version: ^0.7.0
from datetime import datetime
from typing import Dict, Any

from .endpoints.health import router as health_router
from .endpoints.auth import router as auth_router
from .endpoints.documents import router as documents_router
from ..constants import RATE_LIMIT_REQUESTS, RATE_LIMIT_PERIOD
from ..utils.logging import get_correlation_id

# Initialize main v1 router with prefix and tags
router = APIRouter(prefix='/api/v1', tags=['v1'])

# Global constants
API_V1_STR = '/api/v1'
SECURE_HEADERS = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
}

def include_routers() -> None:
    """Configure and include all endpoint routers with proper prefixes and middleware."""
    
    # Configure rate limiting middleware
    router.add_middleware(
        SlowApiMiddleware,
        rate_limit_requests=RATE_LIMIT_REQUESTS,
        rate_limit_period=RATE_LIMIT_PERIOD
    )

    # Configure security headers middleware
    router.add_middleware(
        SecurityMiddleware,
        secure_headers=SECURE_HEADERS,
        enable_hsts=True,
        hsts_max_age=31536000,
        include_subdomains=True
    )

    # Configure metrics middleware
    router.add_middleware(
        MetricsMiddleware,
        namespace="catalog_search",
        subsystem="api",
        excluded_handlers=["/health", "/metrics"]
    )

    # Include routers with proper prefixes
    router.include_router(
        health_router,
        prefix="/health",
        tags=["monitoring"]
    )
    
    router.include_router(
        auth_router,
        prefix="/auth",
        tags=["security"]
    )
    
    router.include_router(
        documents_router,
        prefix="/documents",
        tags=["documents"]
    )

    logger.info("API v1 routers configured successfully")

@router.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Enhanced global exception handler with logging and metrics.
    
    Args:
        request: FastAPI request object
        exc: HTTP exception instance
        
    Returns:
        JSONResponse: Formatted error response with metadata
    """
    correlation_id = get_correlation_id()
    
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
        content=error_data
    )

# Configure routers on module import
include_routers()