"""
Tenant middleware implementation for the AI-powered Product Catalog Search System.
Handles multi-tenant request processing, tenant isolation, and security monitoring.

Version: 1.0.0
"""

from typing import Dict, Optional, Awaitable, Callable
import time
import logging
from fastapi import Request, Response  # version: ^0.103.0
from starlette.middleware.base import BaseHTleware, RequestResponseEndpoint  # version: ^0.27.0
from sqlalchemy import event  # version: ^2.0.0
from prometheus_client import Counter, Histogram  # version: ^0.17.0

from ..core.config import settings, get_settings
from ..db.session import SessionLocal
from ..core.security import verify_token, TenantSecurityManager
from ..exceptions import AuthenticationError, AuthorizationError
from ..utils.logging import StructuredLogger

# Initialize logging
logger = StructuredLogger(__name__)

# Initialize metrics collectors
tenant_requests = Counter(
    'tenant_requests_total',
    'Total number of tenant requests',
    ['tenant_id', 'endpoint']
)
tenant_latency = Histogram(
    'tenant_request_latency_seconds',
    'Request latency by tenant',
    ['tenant_id']
)
tenant_errors = Counter(
    'tenant_errors_total',
    'Total number of tenant errors',
    ['tenant_id', 'error_type']
)

class TenantMiddleware(BaseHTleware):
    """
    Advanced middleware for handling multi-tenant request processing with
    comprehensive security, monitoring, and performance optimization.
    """

    def __init__(self, app: Callable) -> None:
        """
        Initialize tenant middleware with enhanced security and monitoring.
        
        Args:
            app: ASGI application
        """
        super().__init__(app)
        self.app = app
        self.security_manager = TenantSecurityManager()
        self.session_pool: Dict[str, SessionLocal] = {}
        self.settings = get_settings()

        # Configure session event listeners
        event.listen(SessionLocal, 'after_begin', self._after_session_begin)
        event.listen(SessionLocal, 'after_commit', self._after_session_commit)
        event.listen(SessionLocal, 'after_rollback', self._after_session_rollback)

    async def __call__(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """
        Process incoming request with comprehensive tenant context and security validation.
        
        Args:
            request: Incoming request
            call_next: Next middleware in chain
            
        Returns:
            Response with tenant context
            
        Raises:
            AuthenticationError: When tenant authentication fails
            AuthorizationError: When tenant authorization fails
        """
        start_time = time.time()
        tenant_id = None

        try:
            # Extract and validate tenant ID
            tenant_id = await self.get_tenant_id(request)
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
                "tenant_request",
                {
                    "tenant_id": tenant_id,
                    "path": request.url.path,
                    "method": request.method,
                    "duration": time.time() - start_time
                }
            )

            return response

        except AuthenticationError as ae:
            tenant_errors.labels(
                tenant_id=tenant_id or "unknown",
                error_type="authentication"
            ).inc()
            logger.log_security_event(
                "tenant_authentication_failed",
                {
                    "tenant_id": tenant_id,
                    "error": str(ae),
                    "path": request.url.path
                }
            )
            raise

        except AuthorizationError as ae:
            tenant_errors.labels(
                tenant_id=tenant_id or "unknown",
                error_type="authorization"
            ).inc()
            logger.log_security_event(
                "tenant_authorization_failed",
                {
                    "tenant_id": tenant_id,
                    "error": str(ae),
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
                "tenant_request_failed",
                {
                    "tenant_id": tenant_id,
                    "error": str(e),
                    "path": request.url.path
                }
            )
            raise

        finally:
            # Clean up session
            if hasattr(request.state, "db"):
                request.state.db.close()

    async def get_tenant_id(self, request: Request) -> str:
        """
        Extract and thoroughly validate tenant ID with security checks.
        
        Args:
            request: Incoming request
            
        Returns:
            Validated tenant ID
            
        Raises:
            AuthenticationError: When tenant validation fails
        """
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
            token_data = verify_token(token)

            # Validate tenant ID matches token
            if token_data.get("tenant_id") != tenant_header:
                raise AuthenticationError(
                    message="Tenant ID mismatch",
                    auth_type="tenant",
                    security_context={
                        "token_tenant": token_data.get("tenant_id"),
                        "header_tenant": tenant_header
                    }
                )

            return tenant_header

        except Exception as e:
            raise AuthenticationError(
                message=f"Tenant validation failed: {str(e)}",
                auth_type="tenant",
                security_context={"path": request.url.path}
            )

    async def setup_tenant_session(self, tenant_id: str) -> SessionLocal:
        """
        Configure optimized database session with tenant isolation.
        
        Args:
            tenant_id: Validated tenant ID
            
        Returns:
            Configured database session
        """
        if tenant_id not in self.session_pool:
            session = SessionLocal()
            
            # Configure tenant isolation
            session.execute(f"SET app.current_tenant = '{tenant_id}'")
            session.execute("SET app.row_security = ON")
            
            # Set session timeout
            session.execute("SET statement_timeout = '30s'")
            
            self.session_pool[tenant_id] = session

        return self.session_pool[tenant_id]

    def _after_session_begin(self, session: SessionLocal, transaction, connection) -> None:
        """Handle session begin event with monitoring."""
        logger.log_metric("tenant_session_begin", 1, {
            "tenant_id": getattr(session, "tenant_id", "unknown")
        })

    def _after_session_commit(self, session: SessionLocal) -> None:
        """Handle session commit event with monitoring."""
        logger.log_metric("tenant_session_commit", 1, {
            "tenant_id": getattr(session, "tenant_id", "unknown")
        })

    def _after_session_rollback(self, session: SessionLocal) -> None:
        """Handle session rollback event with monitoring."""
        logger.log_metric("tenant_session_rollback", 1, {
            "tenant_id": getattr(session, "tenant_id", "unknown")
        })

def get_tenant_middleware() -> TenantMiddleware:
    """
    Factory function to create configured tenant middleware instance.
    
    Returns:
        Configured tenant middleware
    """
    return TenantMiddleware