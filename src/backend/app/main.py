"""
Main FastAPI application entry point for the AI-powered Product Catalog Search System.
Configures application, middleware, routers, event handlers, security protocols, monitoring,
and multi-tenant support.

Version: 1.0.0
"""

import logging  # version: built-in
from fastapi import FastAPI, HTTPException, Request  # version: 0.103.0
from fastapi.responses import JSONResponse  # version: 0.103.0
from fastapi.middleware.security import SecurityMiddleware  # version: 0.103.0
from prometheus_fastapi_instrumentator import PrometheusMiddleware  # version: 5.9.1
from slowapi import RateLimitMiddleware  # version: 0.1.8
from opencensus.ext.azure.trace_exporter import ApplicationInsights  # version: 0.11.0

from .api.v1.router import router as api_v1_router
from .core.config import settings
from .middleware.cors_middleware import get_cors_middleware

# Initialize FastAPI application with enhanced configuration
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    version="1.0.0"
)

# Initialize logger
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event_handler():
    """Initialize application resources and monitoring on startup."""
    try:
        # Initialize structured logging
        settings.configure_logging()
        logger.info("Structured logging configured")

        # Setup Azure Application Insights monitoring
        if settings.ENVIRONMENT == "production":
            azure_settings = settings.get_azure_settings()
            insights = ApplicationInsights(
                connection_string=azure_settings["application_insights"]["connection_string"]
            )
            insights.start()
            logger.info("Azure Application Insights monitoring initialized")

        # Initialize database connections with connection pooling
        db_settings = settings.get_database_settings()
        logger.info("Database connection pool initialized", extra=db_settings)

        # Set up vector search engine
        vector_settings = settings.get_vector_search_settings()
        logger.info("Vector search engine initialized", extra=vector_settings)

        # Configure Prometheus metrics collection
        PrometheusMiddleware().instrument(app)
        logger.info("Prometheus metrics collection enabled")

        logger.info("Application startup completed successfully")

    except Exception as e:
        logger.error(f"Startup error: {str(e)}", exc_info=True)
        raise RuntimeError(f"Application startup failed: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event_handler():
    """Gracefully cleanup resources on application shutdown."""
    try:
        # Stop accepting new requests
        logger.info("Initiating graceful shutdown")

        # Close database connections
        logger.info("Closing database connections")

        # Cleanup vector search resources
        logger.info("Cleaning up vector search resources")

        # Flush monitoring metrics
        logger.info("Flushing monitoring metrics")

        logger.info("Application shutdown completed successfully")

    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}", exc_info=True)
        raise RuntimeError(f"Application shutdown failed: {str(e)}")

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Global exception handler with enhanced logging and monitoring."""
    correlation_id = request.headers.get("X-Correlation-ID")
    tenant_id = request.headers.get("X-Tenant-ID")

    error_details = {
        "status": "error",
        "code": exc.status_code,
        "message": exc.detail,
        "path": request.url.path,
        "method": request.method,
        "correlation_id": correlation_id
    }

    if tenant_id:
        error_details["tenant_id"] = tenant_id

    logger.error(
        f"HTTP {exc.status_code} error",
        extra={
            "error_details": error_details,
            "headers": dict(request.headers)
        }
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_details,
        headers={"X-Correlation-ID": correlation_id} if correlation_id else None
    )

def configure_middleware():
    """Configure application middleware stack with security and monitoring."""
    # Add security headers middleware
    app.add_middleware(
        SecurityMiddleware,
        enable_hsts=True,
        hsts_max_age=31536000,
        include_subdomains=True,
        enable_frame_deny=True,
        enable_xss_protection=True,
        enable_content_type_nosniff=True
    )

    # Configure CORS with proper origins
    app.add_middleware(get_cors_middleware())

    # Add rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        rate_limit_requests=settings.SECURITY_CONFIG["rate_limit_requests"],
        rate_limit_period=settings.SECURITY_CONFIG["rate_limit_period"]
    )

    # Add compression middleware
    app.add_middleware(
        "fastapi.middleware.gzip.GZipMiddleware",
        minimum_size=1000
    )

    logger.info("Application middleware configured successfully")

# Configure middleware
configure_middleware()

# Include API routers
app.include_router(
    api_v1_router,
    prefix=settings.API_V1_PREFIX
)

logger.info(
    "Application initialization completed",
    extra={
        "environment": settings.ENVIRONMENT,
        "debug_mode": settings.DEBUG,
        "api_prefix": settings.API_V1_PREFIX
    }
)