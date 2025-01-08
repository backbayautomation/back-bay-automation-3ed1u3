"""
Package initialization file for the AI-powered Product Catalog Search System backend application.
Configures package-level imports, version information, security middleware, monitoring, and exports
core application components with multi-tenant isolation.

Version: 1.0.0
"""

import structlog  # version: ^21.5.0
from prometheus_client import Counter, Histogram  # version: ^0.16.0
from fastapi.middleware.cors import CORSMiddleware  # version: ^0.103.0
from fastapi_correlation_id import RequestIDMiddleware  # version: ^0.3.0
from fastapi_multitenancy import TenantMiddleware  # version: ^1.0.0
from fastapi.middleware.security import SecurityMiddleware  # version: ^0.103.0
from prometheus_fastapi_instrumentator import MetricsMiddleware  # version: ^5.9.1

from .core.config import settings
from .main import app

# Package version and name from settings
__version__ = settings.VERSION
__app_name__ = settings.PROJECT_NAME

# Configure structured logging
logger = structlog.get_logger()

# Prometheus metrics
REQUEST_LATENCY = Histogram('http_request_latency_seconds', 'HTTP request latency')
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests')
ERROR_COUNT = Counter('http_errors_total', 'Total HTTP errors')

def init_monitoring():
    """Initialize monitoring, metrics collection, and structured logging."""
    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Initialize Prometheus metrics
    REQUEST_LATENCY.observe(0)  # Initialize histogram
    REQUEST_COUNT.inc(0)  # Initialize counter
    ERROR_COUNT.inc(0)  # Initialize error counter

    logger.info(
        "Monitoring initialized",
        version=__version__,
        app_name=__app_name__,
        environment=settings.ENVIRONMENT
    )

def init_middleware():
    """Initialize and configure all middleware components."""
    # Add correlation ID middleware for request tracking
    app.add_middleware(
        RequestIDMiddleware,
        header_name="X-Correlation-ID",
        generator=lambda: settings.generate_request_id()
    )

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

    # Add CORS middleware with proper configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.SECURITY_CONFIG["cors_origins"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=3600
    )

    # Add multi-tenant isolation middleware
    app.add_middleware(
        TenantMiddleware,
        tenant_header="X-Tenant-ID",
        tenant_model=settings.TENANT_MODEL,
        tenant_id_field="id"
    )

    # Add metrics collection middleware
    app.add_middleware(
        MetricsMiddleware,
        enable_metrics=True,
        metrics_port=9090,
        metrics_path="/metrics"
    )

    logger.info(
        "Middleware initialized",
        middleware_stack=[
            "RequestIDMiddleware",
            "SecurityMiddleware",
            "CORSMiddleware",
            "TenantMiddleware",
            "MetricsMiddleware"
        ]
    )

# Initialize monitoring and middleware
init_monitoring()
init_middleware()

# Export configured application instance
__all__ = ["app", "__version__", "__app_name__", "logger"]