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
import uuid

from .endpoints import (
    router as health_router,
    router as auth_router,
    router as documents_router
)

# Initialize main v1 router
router = APIRouter(prefix='/api/v1', tags=['v1'])

# Constants from settings
API_V1_STR = '/api/v1'
RATE_LIMIT_REQUESTS = 1000
RATE_LIMIT_PERIOD = 3600

def include_routers():
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
        enable_hsts=True,
        hsts_max_age=31536000,
        include_subdomains=True,
        enable_frame_deny=True,
        enable_xss_protection=True,
        enable_content_type_nosniff=True
    )

    # Configure metrics middleware
    router.add_middleware(
        MetricsMiddleware,
        enable_metrics=True,
        metrics_port=9090,
        metrics_path="/metrics"
    )

    # Include health check endpoints
    router.include_router(
        health_router,
        prefix="/health",
        tags=["monitoring"]
    )

    # Include authentication endpoints
    router.include_router(
        auth_router,
        prefix="/auth",
        tags=["security"]
    )

    # Include document management endpoints
    router.include_router(
        documents_router,
        prefix="/documents",
        tags=["documents"]
    )

    logger.info(
        "API router configuration completed",
        extra={
            "routers": ["health", "auth", "documents"],
            "middleware": ["rate_limiting", "security", "metrics"]
        }
    )

@router.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Enhanced global exception handler with logging and metrics.

    Args:
        request: FastAPI request object
        exc: HTTP exception instance

    Returns:
        JSONResponse: Detailed error response with request ID
    """
    # Extract correlation ID from request or generate new one
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
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

    # Format error response
    error_response = {
        "status": "error",
        "code": exc.status_code,
        "message": exc.detail,
        "correlation_id": correlation_id,
        "timestamp": datetime.utcnow().isoformat(),
        "path": request.url.path
    }

    # Include tenant context if available
    if tenant_id:
        error_response["tenant_id"] = tenant_id

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response,
        headers={"X-Correlation-ID": correlation_id}
    )

# Configure routers and middleware
include_routers()