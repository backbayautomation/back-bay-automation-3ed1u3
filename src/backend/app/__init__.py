"""
Package initialization file for the AI-powered Product Catalog Search System backend application.
Configures package-level imports, version information, security middleware, monitoring, and exports
core application components with multi-tenant isolation.

Version: 1.0.0
"""

import structlog  # version: ^21.5.0
import prometheus_client  # version: ^0.16.0
from fastapi.middleware.cors import CORSMiddleware  # version: ^0.103.0
from fastapi_correlation_id import RequestIDMiddleware  # version: ^0.3.0
from fastapi_multitenancy import TenantMiddleware  # version: ^1.0.0
from fastapi.middleware.security import SecurityMiddleware  # version: ^0.103.0
from prometheus_fastapi_instrumentator import MetricsMiddleware  # version: ^5.9.1

from .core.config import settings
from .main import app

# Initialize version and application name
__version__ = settings.VERSION
__app_name__ = settings.PROJECT_NAME

# Initialize structured logging
logger = structlog.get_logger()

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
    prometheus_client.REGISTRY.unregister(prometheus_client.GC_COLLECTOR)
    prometheus_client.REGISTRY.unregister(prometheus_client.PLATFORM_COLLECTOR)
    prometheus_client.REGISTRY.unregister(prometheus_client.PROCESS_COLLECTOR)

    # Configure custom metrics
    prometheus_client.Counter(
        'app_requests_total',
        'Total application requests',
        ['method', 'endpoint', 'tenant_id']
    )
    prometheus_client.Histogram(
        'app_request_latency_seconds',
        'Request latency in seconds',
        ['method', 'endpoint']
    )
    prometheus_client.Gauge(
        'app_active_requests',
        'Number of active requests',
        ['tenant_id']
    )

def init_middleware():
    """Initialize and configure all middleware components."""
    # Add correlation ID middleware for request tracking
    app.add_middleware(
        RequestIDMiddleware,
        header_name="X-Correlation-ID",
        generator=lambda: str(uuid.uuid4()),
        validator=lambda x: bool(x)
    )

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

    # Add CORS middleware with configuration from settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.SECURITY_CONFIG['cors']['allowed_origins'],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Correlation-ID", "X-Request-ID"]
    )

    # Add multi-tenant isolation middleware
    app.add_middleware(
        TenantMiddleware,
        tenant_header="X-Tenant-ID",
        tenant_model=None,  # Using header-based tenant identification
        tenant_validator=lambda x: bool(x)
    )

    # Add metrics collection middleware
    app.add_middleware(
        MetricsMiddleware,
        instrument_requests=True,
        instrument_responses=True,
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        env_var_name="ENABLE_METRICS",
        excluded_handlers=["/metrics", "/health"]
    )

# Initialize monitoring and middleware
init_monitoring()
init_middleware()

# Export core components
__all__ = [
    'app',
    '__version__',
    '__app_name__',
    'logger'
]