"""
Tenant middleware implementation for handling multi-tenant request processing,
authentication, and database session management with comprehensive security monitoring.

Version: 1.0.0
"""

from typing import Dict, Optional, Awaitable, Callable
import time
import logging
from fastapi import Request  # version: ^0.103.0
from starlette.middleware.base import BaseHTTPMiddleware  # version: ^0.27.0
from sqlalchemy import event  # version: ^2.0.0
from prometheus_client import Counter, Histogram  # version: ^0.17.0

from ..core.config import settings
from ..db.session import SessionLocal
from ..core.security import verify_token, TenantSecurityManager
from ..exceptions import AuthenticationError, AuthorizationError
from ..utils.logging import StructuredLogger

# Initialize structured logger
logger = StructuredLogger(__name__)

# Prometheus metrics
tenant_requests = Counter(
    'tenant_requests_total',
    'Total tenant requests',
    ['tenant_id', 'endpoint']
)
tenant_latency = Histogram(
    'tenant_request_latency_seconds',
    'Request latency by tenant',
    ['tenant_id']
)
tenant_errors = Counter(
    'tenant_errors_total',
    'Total tenant errors',
    ['tenant_id', 'error_type']
)

class TenantMiddleware(BaseHTTPMiddleware):
    """
    Advanced middleware for handling multi-tenant request processing with comprehensive
    security, monitoring, and performance optimization.
    """

    def __init__(self, app):
        """
        Initialize tenant middleware with enhanced security and monitoring capabilities.
        
        Args:
            app: ASGI application
        """
        super().__init__(app)
        self.app = app
        self.security_manager = TenantSecurityManager()
        self.session_pool: Dict[str, SessionLocal] = {}
        
        # Configure session event listeners
        self._configure_session_events()

    async def dispatch(self, request: Request, call_next: Callable) -> Awaitable:
        """
        Process incoming request with comprehensive tenant context and security validation.
        
        Args:
            request: Incoming request
            call_next: Next middleware in chain
            
        Returns:
            Response with tenant context and security headers
        """
        start_time = time.time()
        tenant_id = None

        try:
            # Extract and validate tenant ID
            tenant_id = await self.get_tenant_id(request)
            
            # Set up tenant context
            request.state.tenant_id = tenant_id
            
            # Validate tenant access
            await self.security_manager.validate_tenant_access(tenant_id, request)
            
            # Set up database session with tenant context
            session = await self.setup_tenant_session(tenant_id)
            request.state.db = session

            # Process request
            response = await call_next(request)
            
            # Update metrics
            tenant_requests.labels(
                tenant_id=tenant_id,
                endpoint=request.url.path
            ).inc()
            
            tenant_latency.labels(
                tenant_id=tenant_id
            ).observe(time.time() - start_time)
            
            # Log successful request
            logger.log_security_event(
                "tenant_request_success",
                {
                    "tenant_id": tenant_id,
                    "path": request.url.path,
                    "method": request.method,
                    "duration": time.time() - start_time
                }
            )

            return response

        except AuthenticationError as e:
            tenant_errors.labels(
                tenant_id=tenant_id or "unknown",
                error_type="authentication"
            ).inc()
            logger.log_security_event(
                "tenant_authentication_error",
                {
                    "tenant_id": tenant_id,
                    "error": str(e),
                    "path": request.url.path
                }
            )
            raise

        except AuthorizationError as e:
            tenant_errors.labels(
                tenant_id=tenant_id or "unknown",
                error_type="authorization"
            ).inc()
            logger.log_security_event(
                "tenant_authorization_error",
                {
                    "tenant_id": tenant_id,
                    "error": str(e),
                    "path": request.url.path
                }
            )
            raise

        except Exception as e:
            tenant_errors.labels(
                tenant_id=tenant_id or "unknown",
                error_type="general"
            ).inc()
            logger.log_security_event(
                "tenant_request_error",
                {
                    "tenant_id": tenant_id,
                    "error": str(e),
                    "path": request.url.path
                }
            )
            raise

        finally:
            # Clean up session if it exists
            if hasattr(request.state, "db"):
                request.state.db.close()

    async def get_tenant_id(self, request: Request) -> str:
        """
        Extract and thoroughly validate tenant ID with security checks.
        
        Args:
            request: Incoming request
            
        Returns:
            Validated and sanitized tenant ID
        
        Raises:
            AuthenticationError: If tenant authentication fails
        """
        # Extract tenant header
        tenant_header = request.headers.get("X-Tenant-ID")
        if not tenant_header:
            raise AuthenticationError(
                message="Missing tenant ID header",
                auth_type="tenant",
                security_context={"path": request.url.path}
            )

        try:
            # Verify tenant token
            token = request.headers.get("Authorization", "").split("Bearer ")[-1]
            if not token:
                raise AuthenticationError(
                    message="Missing authorization token",
                    auth_type="tenant",
                    security_context={"tenant_id": tenant_header}
                )

            # Verify and decode token
            payload = verify_token(token)
            
            # Validate tenant ID matches token
            if payload.get("tenant_id") != tenant_header:
                raise AuthenticationError(
                    message="Tenant ID mismatch",
                    auth_type="tenant",
                    security_context={
                        "tenant_id": tenant_header,
                        "token_tenant": payload.get("tenant_id")
                    }
                )

            return tenant_header

        except Exception as e:
            raise AuthenticationError(
                message=f"Tenant authentication failed: {str(e)}",
                auth_type="tenant",
                security_context={"tenant_id": tenant_header}
            )

    async def setup_tenant_session(self, tenant_id: str) -> SessionLocal:
        """
        Configure optimized database session with tenant isolation.
        
        Args:
            tenant_id: Validated tenant ID
            
        Returns:
            Configured and optimized database session
        """
        # Check session pool
        if tenant_id not in self.session_pool:
            session = SessionLocal()
            
            # Configure tenant isolation
            @event.listens_for(session, "before_cursor_execute")
            def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
                # Set tenant context for row-level security
                conn.execute(f"SET app.current_tenant = '{tenant_id}'")
            
            self.session_pool[tenant_id] = session

        return self.session_pool[tenant_id]

    def _configure_session_events(self):
        """Configure session event listeners for monitoring and security."""
        @event.listens_for(SessionLocal, "after_begin")
        def after_begin(session, transaction, connection):
            logger.log_metric(
                "tenant_session_begin",
                1.0,
                {"tenant_id": getattr(session, "tenant_id", "unknown")}
            )

        @event.listens_for(SessionLocal, "after_commit")
        def after_commit(session):
            logger.log_metric(
                "tenant_session_commit",
                1.0,
                {"tenant_id": getattr(session, "tenant_id", "unknown")}
            )

        @event.listens_for(SessionLocal, "after_rollback")
        def after_rollback(session):
            logger.log_metric(
                "tenant_session_rollback",
                1.0,
                {"tenant_id": getattr(session, "tenant_id", "unknown")}
            )

def get_tenant_middleware() -> TenantMiddleware:
    """
    Factory function to create configured tenant middleware instance.
    
    Returns:
        Configured tenant middleware with security and monitoring
    """
    return TenantMiddleware