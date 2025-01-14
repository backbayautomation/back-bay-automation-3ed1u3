"""
Package initialization module for the AI-powered Product Catalog Search System.
Configures core application components with comprehensive security, monitoring,
and multi-tenant isolation.

Version: 1.0.0
"""

import structlog  # version: ^21.5.0
from prometheus_client import Counter, Gauge  # version: ^0.16.0
from fastapi.middleware.cors import CORSMiddleware  # version: ^0.103.0
from fastapi_correlation_id import RequestIDMiddleware  # version: ^0.3.0
from fastapi_multitenancy import TenantMiddleware  # version: ^1.0.0
from fastapi.middleware.security import SecurityMiddleware  # version: ^0.103.0
from prometheus_fastapi_instrumentator import MetricsMiddleware  # version: ^5.9.1

from .core.config import settings
from .main import app

# Global version and application name
__version__ = settings.VERSION
__app_name__ = settings.PROJECT_NAME

# Initialize structured logger
logger = structlog.get_logger()

# Initialize Prometheus metrics
INIT_ERRORS = Counter(
    'app_initialization_errors_total',
    'Total number of initialization errors'
)
ACTIVE_TENANTS = Gauge(
    'app_active_tenants',
    'Number of active tenants'
)

def init_monitoring():
    """Initialize monitoring, metrics collection, and structured logging."""
    try:
        # Configure structured logging
        structlog.configure(
            processors=[
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.add_log_level,
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            wrapper_class=structlog.BoundLogger,
            cache_logger_on_first_use=True
        )

        # Initialize Prometheus metrics
        MetricsMiddleware(
            app,
            group_paths=True,
            buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
            filter_unhandled_paths=True,
            metric_namespace="catalog_search",
            metric_subsystem="api"
        )

        # Configure health check endpoints
        app.add_route("/health", include_in_schema=False)
        app.add_route("/metrics", include_in_schema=False)

        logger.info("Monitoring initialized successfully")

    except Exception as e:
        INIT_ERRORS.inc()
        logger.error(f"Monitoring initialization failed: {str(e)}", exc_info=True)
        raise

def init_middleware():
    """Initialize and configure all middleware components."""
    try:
        # Add correlation ID middleware for request tracking
        app.add_middleware(
            RequestIDMiddleware,
            header_name="X-Correlation-ID",
            generator=lambda: uuid4().hex,
            validator=lambda x: bool(x)
        )

        # Add security headers middleware
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

        # Add CORS middleware with environment-specific configuration
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.SECURITY_CONFIG['cors_origins'],
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["X-Total-Count"]
        )

        # Add multi-tenant isolation middleware
        app.add_middleware(
            TenantMiddleware,
            tenant_header="X-Tenant-ID",
            tenant_model="app.models.organization.Organization",
            tenant_id_field="id"
        )

        # Add metrics collection middleware
        app.add_middleware(
            MetricsMiddleware,
            filter_unhandled_paths=True,
            group_paths=True,
            metric_namespace="catalog_search",
            metric_subsystem="api"
        )

        logger.info("Middleware stack initialized successfully")

    except Exception as e:
        INIT_ERRORS.inc()
        logger.error(f"Middleware initialization failed: {str(e)}", exc_info=True)
        raise

# Initialize application components
init_monitoring()
init_middleware()

# Export configured application instance
__all__ = ['app', '__version__', '__app_name__', 'logger']