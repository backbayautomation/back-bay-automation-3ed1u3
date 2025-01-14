"""
FastAPI middleware for multi-tenant request processing with comprehensive security,
monitoring, and performance optimization features.

Version: 1.0.0
"""

import time
import logging
from typing import Dict, Any, Optional
from contextlib import contextmanager

from fastapi import Request, Response  # version: 0.103.0
from starlette.middleware.base import BaseHTTPMiddleware  # version: 0.27.0
from sqlalchemy import event  # version: 2.0.0
from prometheus_client import Counter, Histogram  # version: 0.17.0

from ..core.config import settings, get_settings
from ..db.session import SessionLocal
from ..core.security import verify_token, TenantSecurityManager
from ..exceptions import AuthenticationError, AuthorizationError

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize Prometheus metrics
tenant_metrics = Counter(
    'tenant_requests_total',
    'Total tenant requests',
    ['tenant_id', 'endpoint']
)
tenant_latency = Histogram(
    'tenant_request_latency_seconds',
    'Request latency by tenant',
    ['tenant_id']
)

class TenantMiddleware(BaseHTTPMiddleware):
    """
    Advanced middleware for handling multi-tenant request processing with
    comprehensive security, monitoring, and performance optimization.
    """

    def __init__(self, app):
        """
        Initialize tenant middleware with enhanced security and monitoring.
        
        Args:
            app: ASGI application instance
        """
        super().__init__(app)
        self.app = app
        self.security_manager = TenantSecurityManager()
        self.session_pool: Dict[str, SessionLocal] = {}
        self.settings = get_settings()

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process incoming request with comprehensive tenant context and security validation.
        
        Args:
            request: Incoming HTTP request
            call_next: ASGI application call chain
            
        Returns:
            Response with tenant context and security headers
        """
        start_time = time.time()
        tenant_id = None
        session = None

        try:
            # Extract and validate tenant information
            tenant_id = await self.get_tenant_id(request)
            if not tenant_id:
                raise AuthenticationError("Tenant ID not provided")

            # Set up tenant context and monitoring
            request.state.tenant_id = tenant_id
            request.state.correlation_id = request.headers.get('X-Correlation-ID')

            # Configure tenant-specific database session
            session = await self.setup_tenant_session(tenant_id)
            request.state.db = session

            # Process request with security context
            response = await call_next(request)

            # Add security headers
            response.headers.update(self.settings.SECURITY_CONFIG['secure_headers'])

            # Update metrics
            tenant_metrics.labels(
                tenant_id=tenant_id,
                endpoint=request.url.path
            ).inc()

            # Record request latency
            request_time = time.time() - start_time
            tenant_latency.labels(tenant_id=tenant_id).observe(request_time)

            # Log successful request
            logger.info(
                "Tenant request processed successfully",
                extra={
                    'tenant_id': tenant_id,
                    'path': request.url.path,
                    'method': request.method,
                    'duration': request_time,
                    'correlation_id': request.state.correlation_id
                }
            )

            return response

        except AuthenticationError as ae:
            logger.error(
                "Tenant authentication failed",
                extra={
                    'tenant_id': tenant_id,
                    'error': str(ae),
                    'correlation_id': getattr(request.state, 'correlation_id', None)
                }
            )
            raise

        except AuthorizationError as ae:
            logger.error(
                "Tenant authorization failed",
                extra={
                    'tenant_id': tenant_id,
                    'error': str(ae),
                    'correlation_id': getattr(request.state, 'correlation_id', None)
                }
            )
            raise

        except Exception as e:
            logger.error(
                "Tenant request processing failed",
                extra={
                    'tenant_id': tenant_id,
                    'error': str(e),
                    'correlation_id': getattr(request.state, 'correlation_id', None)
                },
                exc_info=True
            )
            raise

        finally:
            # Clean up resources
            if session:
                session.close()

    async def get_tenant_id(self, request: Request) -> Optional[str]:
        """
        Extract and thoroughly validate tenant ID with security checks.
        
        Args:
            request: Incoming HTTP request
            
        Returns:
            Validated tenant ID or None
        """
        # Extract tenant information from request
        tenant_header = request.headers.get('X-Tenant-ID')
        auth_header = request.headers.get('Authorization')

        if not tenant_header or not auth_header:
            raise AuthenticationError("Missing tenant or authorization headers")

        try:
            # Verify JWT token and extract claims
            token = auth_header.split(' ')[1]
            token_data = verify_token(token)

            # Validate tenant access
            if not self.security_manager.validate_tenant_access(
                tenant_id=tenant_header,
                token_data=token_data
            ):
                raise AuthorizationError("Invalid tenant access")

            # Log tenant validation
            self.security_manager.log_tenant_activity(
                tenant_id=tenant_header,
                activity_type="tenant_validation",
                token_data=token_data
            )

            return tenant_header

        except Exception as e:
            logger.error(
                "Tenant validation failed",
                extra={
                    'tenant_id': tenant_header,
                    'error': str(e)
                }
            )
            raise AuthenticationError(f"Tenant validation failed: {str(e)}")

    async def setup_tenant_session(self, tenant_id: str) -> SessionLocal:
        """
        Configure optimized database session with tenant isolation.
        
        Args:
            tenant_id: Validated tenant identifier
            
        Returns:
            Configured database session
        """
        try:
            # Get or create session from pool
            if tenant_id not in self.session_pool:
                session = SessionLocal()
                
                # Configure session for tenant
                session.execute(f"SET app.current_tenant = '{tenant_id}'")
                
                # Set up row-level security
                @event.listens_for(session, 'before_cursor_execute')
                def add_tenant_filter(conn, cursor, statement, params, context, executemany):
                    if 'app.current_tenant' not in statement:
                        cursor.execute(f"SET app.current_tenant = '{tenant_id}'")

                self.session_pool[tenant_id] = session
            
            return self.session_pool[tenant_id]

        except Exception as e:
            logger.error(
                "Failed to setup tenant session",
                extra={
                    'tenant_id': tenant_id,
                    'error': str(e)
                }
            )
            raise

def get_tenant_middleware():
    """
    Factory function to create configured tenant middleware instance.
    
    Returns:
        Configured TenantMiddleware instance
    """
    return TenantMiddleware