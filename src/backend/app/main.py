"""
Main FastAPI application entry point for the AI-powered Product Catalog Search System.
Configures application, middleware, routers, event handlers, security protocols,
monitoring, and multi-tenant support.

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

# Initialize FastAPI application with configuration from settings
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f'{settings.API_V1_PREFIX}/openapi.json',
    docs_url=f'{settings.API_V1_PREFIX}/docs',
    redoc_url=f'{settings.API_V1_PREFIX}/redoc'
)

# Initialize logger
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event_handler() -> None:
    """Initialize application resources and monitoring on startup."""
    try:
        # Initialize structured logging
        settings.configure_logging()
        logger.info("Logging configured successfully")

        # Setup Azure Application Insights monitoring
        if settings.ENVIRONMENT != 'development':
            azure_settings = settings.get_azure_settings()
            app.state.ai_exporter = ApplicationInsights(
                connection_string=azure_settings['monitor_connection_string']
            )
            logger.info("Azure Application Insights initialized")

        # Initialize database connections
        db_settings = settings.get_database_settings()
        app.state.db_pool = await init_database_pool(db_settings)
        logger.info("Database connection pool initialized")

        # Set up vector search engine
        vector_settings = settings.get_vector_search_settings()
        app.state.vector_search = await init_vector_search(vector_settings)
        logger.info("Vector search engine initialized")

        # Initialize Azure services
        app.state.azure_client = await init_azure_services(azure_settings)
        logger.info("Azure services initialized")

        # Configure Prometheus metrics collection
        configure_metrics()
        logger.info("Metrics collection configured")

        # Start background task scheduler
        app.state.scheduler = await init_task_scheduler()
        logger.info("Task scheduler initialized")

        # Initialize rate limiter
        app.state.rate_limiter = init_rate_limiter()
        logger.info("Rate limiter initialized")

        logger.info("Application startup completed successfully")

    except Exception as e:
        logger.critical(f"Application startup failed: {str(e)}", exc_info=True)
        raise

@app.on_event("shutdown")
async def shutdown_event_handler() -> None:
    """Gracefully cleanup resources on application shutdown."""
    try:
        # Stop accepting new requests
        app.state.accepting_requests = False
        logger.info("Stopped accepting new requests")

        # Wait for ongoing requests to complete
        await wait_for_requests_completion()
        logger.info("All pending requests completed")

        # Close database connections
        if hasattr(app.state, 'db_pool'):
            await app.state.db_pool.close()
            logger.info("Database connections closed")

        # Cleanup vector search resources
        if hasattr(app.state, 'vector_search'):
            await app.state.vector_search.cleanup()
            logger.info("Vector search resources cleaned up")

        # Stop background task scheduler
        if hasattr(app.state, 'scheduler'):
            await app.state.scheduler.shutdown()
            logger.info("Task scheduler stopped")

        # Flush monitoring metrics
        if hasattr(app.state, 'ai_exporter'):
            await app.state.ai_exporter.flush()
            logger.info("Monitoring metrics flushed")

        # Close Azure service connections
        if hasattr(app.state, 'azure_client'):
            await app.state.azure_client.close()
            logger.info("Azure service connections closed")

        logger.info("Application shutdown completed successfully")

    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}", exc_info=True)
        raise

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Global exception handler with enhanced error tracking and correlation."""
    correlation_id = request.headers.get("X-Correlation-ID", "unknown")
    tenant_id = request.headers.get("X-Tenant-ID", "unknown")

    error_details = {
        "status": "error",
        "code": exc.status_code,
        "message": exc.detail,
        "correlation_id": correlation_id,
        "path": request.url.path,
        "method": request.method,
        "timestamp": datetime.utcnow().isoformat()
    }

    # Log error with context
    logger.error(
        f"HTTP {exc.status_code} error occurred",
        extra={
            "correlation_id": correlation_id,
            "tenant_id": tenant_id,
            "error_details": error_details
        }
    )

    # Track error in Application Insights
    if hasattr(app.state, 'ai_exporter'):
        app.state.ai_exporter.track_exception(exc)

    return JSONResponse(
        status_code=exc.status_code,
        content=error_details,
        headers=exc.headers
    )

def configure_middleware() -> None:
    """Configure application middleware stack with security and monitoring."""
    # Add security headers middleware
    app.add_middleware(
        SecurityMiddleware,
        enable_hsts=True,
        hsts_max_age=31536000,
        enable_frame_options=True,
        frame_options_allow_from=None,
        enable_content_type_nosniff=True,
        enable_xss_protection=True,
        xss_protection_mode="block"
    )

    # Configure CORS middleware
    app.add_middleware(get_cors_middleware())

    # Add rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        key_func=lambda r: f"{r.client.host}:{r.headers.get('X-Tenant-ID', 'unknown')}"
    )

    # Add correlation ID middleware
    app.add_middleware(
        CorrelationMiddleware,
        header_name="X-Correlation-ID"
    )

    # Add compression middleware
    app.add_middleware(
        GZipMiddleware,
        minimum_size=1000
    )

    # Add metrics collection middleware
    app.add_middleware(PrometheusMiddleware)

    # Add request logging middleware
    app.add_middleware(RequestLoggingMiddleware)

# Configure application
configure_middleware()

# Include API routers
app.include_router(
    api_v1_router,
    prefix=settings.API_V1_PREFIX
)

# Export application instance
__all__ = ['app']