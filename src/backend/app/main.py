"""
Main FastAPI application entry point for the AI-powered Product Catalog Search System.
Implements comprehensive application configuration, middleware, security, and monitoring.

Version: 1.0.0
"""

import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.security import SecurityMiddleware
from prometheus_fastapi_instrumentator import PrometheusMiddleware
from slowapi import RateLimitMiddleware
from opencensus.ext.azure.trace_exporter import ApplicationInsights
from typing import Dict, Any

from .api.v1.router import router as api_v1_router
from .core.config import settings
from .middleware.cors_middleware import get_cors_middleware
from .utils.logging import StructuredLogger

# Initialize structured logger
logger = StructuredLogger(__name__)

# Initialize FastAPI application with enhanced configuration
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    version="1.0.0",
    debug=settings.DEBUG
)

@app.on_event("startup")
async def startup_event_handler() -> None:
    """
    Handle application startup tasks including resource initialization and monitoring setup.
    Configures all required services, connections, and monitoring tools.
    """
    try:
        # Initialize structured logging
        settings.configure_logging()
        logger.info("Logging configured successfully")

        # Setup Azure Application Insights monitoring
        if settings.ENVIRONMENT != "development":
            insights_connection = settings.AZURE_CONFIG['application_insights']['connection_string']
            exporter = ApplicationInsights(connection_string=insights_connection)
            logger.info("Azure Application Insights configured")

        # Configure middleware stack
        configure_middleware()
        logger.info("Middleware stack configured")

        # Include API routers
        app.include_router(
            api_v1_router,
            prefix=settings.API_V1_PREFIX
        )
        logger.info("API routers configured")

        # Initialize database connections
        from .db.session import init_db
        if not init_db():
            raise RuntimeError("Database initialization failed")
        logger.info("Database connections initialized")

        # Initialize vector search service
        from .services.vector_search import VectorSearchService
        vector_search = VectorSearchService(
            db_session=None,  # Will be injected by dependency system
            cache_client=None,  # Will be injected by dependency system
            config=settings.get_vector_search_settings()
        )
        logger.info("Vector search service initialized")

        # Initialize document processor
        from .services.document_processor import DocumentProcessor
        document_processor = DocumentProcessor(
            ocr_service=None,  # Will be injected by dependency system
            ai_service=None,   # Will be injected by dependency system
            vector_search=vector_search,
            config=settings._settings['document_processing']
        )
        logger.info("Document processor initialized")

        logger.info("Application startup completed successfully")

    except Exception as e:
        logger.error(f"Startup failed: {str(e)}", exc_info=True)
        raise RuntimeError(f"Application startup failed: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event_handler() -> None:
    """
    Handle graceful application shutdown and resource cleanup.
    Ensures proper closing of connections and resource release.
    """
    try:
        # Stop accepting new requests
        app.state.accepting_requests = False
        logger.info("Stopped accepting new requests")

        # Close database connections
        from .db.session import SessionLocal
        session = SessionLocal()
        session.close()
        logger.info("Database connections closed")

        # Cleanup vector search resources
        if hasattr(app.state, 'vector_search'):
            await app.state.vector_search.cleanup()
        logger.info("Vector search resources cleaned up")

        # Flush monitoring metrics
        if settings.ENVIRONMENT != "development":
            # Flush Azure Application Insights
            from opencensus.ext.azure import metrics_exporter
            metrics_exporter.flush()
            logger.info("Monitoring metrics flushed")

        logger.info("Application shutdown completed successfully")

    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}", exc_info=True)
        raise RuntimeError(f"Application shutdown failed: {str(e)}")

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Global exception handler for HTTP errors with enhanced logging and monitoring.
    
    Args:
        request: FastAPI request object
        exc: HTTP exception instance
        
    Returns:
        JSONResponse: Formatted error response with correlation ID
    """
    # Extract request context
    correlation_id = request.headers.get("X-Correlation-ID")
    tenant_id = request.headers.get("X-Tenant-ID")

    error_data = {
        "status_code": exc.status_code,
        "detail": exc.detail,
        "correlation_id": correlation_id,
        "path": str(request.url),
        "method": request.method
    }

    # Log error with context
    logger.log_security_event(
        "http_error",
        {
            "error_code": exc.status_code,
            "error_detail": exc.detail,
            "correlation_id": correlation_id,
            "tenant_id": tenant_id,
            "path": str(request.url)
        }
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=error_data
    )

def configure_middleware() -> None:
    """
    Configure application middleware stack with security and monitoring features.
    Sets up CORS, rate limiting, security headers, and monitoring middleware.
    """
    # Security headers middleware
    app.add_middleware(
        SecurityMiddleware,
        enable_hsts=True,
        hsts_max_age=31536000,
        include_subdomains=True,
        force_https=settings.ENVIRONMENT != "development",
        content_security_policy={
            "default-src": "'self'",
            "img-src": "'self' data: https:",
            "script-src": "'self'",
            "style-src": "'self' 'unsafe-inline'",
            "frame-ancestors": "'none'"
        }
    )

    # CORS middleware
    app.add_middleware(
        get_cors_middleware()
    )

    # Rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        key_func=lambda r: f"{r.client.host}:{r.headers.get('X-Tenant-ID', 'default')}",
        rate_limit_requests=settings.RATE_LIMIT_REQUESTS,
        rate_limit_period=settings.RATE_LIMIT_PERIOD
    )

    # Prometheus metrics middleware
    app.add_middleware(
        PrometheusMiddleware,
        filter_unhandled_paths=True,
        group_paths=True,
        buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
        metric_namespace="catalog_search",
        metric_subsystem="api"
    )

    # Add correlation ID middleware
    from .middleware.correlation import CorrelationMiddleware
    app.add_middleware(CorrelationMiddleware)

    logger.info("All middleware configured successfully")