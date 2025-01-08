"""
Main FastAPI router configuration for the AI-powered Product Catalog Search System API v1.
Implements comprehensive routing with advanced middleware, security controls, and monitoring.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Request  # version: ^0.103.0
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

# Initialize main router with prefix and tags
router = APIRouter(prefix='/api/v1', tags=['v1'])

# Constants from technical specifications
API_V1_STR = '/api/v1'
RATE_LIMIT_REQUESTS = 1000  # requests per hour
RATE_LIMIT_PERIOD = 3600   # period in seconds

def include_routers() -> None:
    """Configure and include all endpoint routers with proper middleware."""
    
    # Configure rate limiting middleware
    router.add_middleware(
        SlowApiMiddleware,
        limit=RATE_LIMIT_REQUESTS,
        window=RATE_LIMIT_PERIOD,
        key_func=lambda request: request.client.host
    )

    # Configure security middleware with secure defaults
    router.add_middleware(
        SecurityMiddleware,
        enable_hsts=True,
        hsts_max_age=31536000,
        include_subdomains=True,
        enable_frame_options=True,
        frame_options_allow_from=None,
        enable_content_type_nosniff=True,
        enable_xss_protection=True,
        xss_protection_mode="block"
    )

    # Configure metrics middleware
    router.add_middleware(
        MetricsMiddleware,
        instrument_requests=True,
        instrument_responses=True,
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        env_var_name="ENABLE_METRICS",
        excluded_handlers=["/metrics", "/health"]
    )

    # Include routers with proper prefixes and tags
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

    logger.info("API routers configured successfully")

@router.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException
) -> JSONResponse:
    """Enhanced global exception handler with logging and metrics."""
    
    # Extract correlation ID from request
    correlation_id = request.headers.get("X-Correlation-ID", "unknown")
    
    # Log error with context
    logger.error(
        f"HTTP {exc.status_code} error occurred",
        extra={
            "correlation_id": correlation_id,
            "path": request.url.path,
            "method": request.method,
            "client_ip": request.client.host,
            "status_code": exc.status_code,
            "detail": exc.detail
        }
    )

    # Format error response
    error_response = {
        "status": "error",
        "code": exc.status_code,
        "message": exc.detail,
        "timestamp": datetime.utcnow().isoformat(),
        "correlation_id": correlation_id,
        "path": request.url.path
    }

    # Include tenant context if available
    tenant_id = request.headers.get("X-Tenant-ID")
    if tenant_id:
        error_response["tenant_id"] = tenant_id

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response,
        headers=exc.headers
    )

# Initialize routers and middleware
include_routers()

# Export configured router
__all__ = ['router']