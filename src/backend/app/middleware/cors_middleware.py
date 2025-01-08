"""
Enhanced CORS middleware implementation with security monitoring and metrics collection
for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from fastapi.middleware.cors import CORSMiddleware  # version: 0.103.0
from fastapi import Request  # version: 0.103.0
import logging  # version: Python 3.11+
import prometheus_client  # version: 0.17.1
import asyncio  # version: Python 3.11+
from typing import Dict, Any, Optional
from datetime import datetime

from ..core.config import settings

# Global CORS configuration
ALLOWED_ORIGINS = settings.SECURITY_CONFIG['cors']['allowed_origins']
ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'X-Client-ID', 'X-Correlation-ID']

# Prometheus metrics for CORS monitoring
CORS_METRICS = prometheus_client.Counter(
    'cors_requests_total',
    'Total CORS requests',
    ['origin', 'status']
)

VIOLATION_METRICS = prometheus_client.Counter(
    'cors_violations_total',
    'Total CORS violations',
    ['origin', 'type']
)

class CORSLoggingMiddleware:
    """Enhanced middleware for comprehensive CORS logging and security monitoring."""

    def __init__(self, app: Any, config: Dict[str, Any]):
        self.app = app
        self.config = config
        self.logger = logging.getLogger("cors_middleware")
        self.active_requests = prometheus_client.Gauge(
            'cors_active_requests',
            'Number of active CORS requests',
            ['origin']
        )
        self.origin_cache: Dict[str, Dict[str, Any]] = {}
        self._setup_rate_limiters()

    def _setup_rate_limiters(self) -> None:
        """Initialize rate limiting configuration."""
        self.rate_limit_window = 3600  # 1 hour
        self.max_requests = self.config.get('max_requests_per_hour', 1000)
        self.rate_limit_store: Dict[str, Dict[str, Any]] = {}

    async def check_security_policy(self, request: Request) -> Dict[str, Any]:
        """Validate request against security policies and update metrics."""
        origin = request.headers.get('origin', 'unknown')
        client_id = request.headers.get('x-client-id')
        
        security_result = {
            'allowed': False,
            'violation_type': None,
            'rate_limited': False
        }

        # Check if origin is allowed
        if origin not in ALLOWED_ORIGINS:
            security_result['violation_type'] = 'invalid_origin'
            VIOLATION_METRICS.labels(origin=origin, type='invalid_origin').inc()
            self.logger.warning(f"Invalid origin attempt: {origin}", extra={
                'client_id': client_id,
                'origin': origin,
                'timestamp': datetime.utcnow().isoformat()
            })
            return security_result

        # Rate limiting check
        rate_limit_key = f"{origin}:{client_id}" if client_id else origin
        current_time = datetime.utcnow().timestamp()
        
        if rate_limit_key in self.rate_limit_store:
            request_history = self.rate_limit_store[rate_limit_key]
            # Clean up old requests
            request_history['requests'] = [
                ts for ts in request_history['requests']
                if current_time - ts < self.rate_limit_window
            ]
            
            if len(request_history['requests']) >= self.max_requests:
                security_result['rate_limited'] = True
                VIOLATION_METRICS.labels(origin=origin, type='rate_limit').inc()
                return security_result
            
            request_history['requests'].append(current_time)
        else:
            self.rate_limit_store[rate_limit_key] = {
                'requests': [current_time]
            }

        security_result['allowed'] = True
        return security_result

    async def __call__(self, request: Request, call_next: Any):
        """Handle CORS request processing with comprehensive security checks."""
        origin = request.headers.get('origin', 'unknown')
        correlation_id = request.headers.get('x-correlation-id', '')

        # Increment active requests counter
        self.active_requests.labels(origin=origin).inc()

        try:
            # Perform security policy check
            security_check = await self.check_security_policy(request)
            
            if not security_check['allowed']:
                CORS_METRICS.labels(origin=origin, status='rejected').inc()
                return await self._handle_rejection(request, security_check['violation_type'])

            # Process the request
            response = await call_next(request)

            # Add CORS headers
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = ', '.join(ALLOWED_METHODS)
            response.headers['Access-Control-Allow-Headers'] = ', '.join(ALLOWED_HEADERS)
            response.headers['Access-Control-Max-Age'] = '3600'
            response.headers['X-Content-Type-Options'] = 'nosniff'
            
            # Log successful request
            self.logger.info("CORS request processed", extra={
                'origin': origin,
                'correlation_id': correlation_id,
                'method': request.method,
                'path': request.url.path,
                'status_code': response.status_code
            })

            CORS_METRICS.labels(origin=origin, status='success').inc()
            return response

        except Exception as e:
            self.logger.error("CORS processing error", extra={
                'origin': origin,
                'correlation_id': correlation_id,
                'error': str(e),
                'error_type': type(e).__name__
            })
            CORS_METRICS.labels(origin=origin, status='error').inc()
            raise

        finally:
            # Decrement active requests counter
            self.active_requests.labels(origin=origin).dec()

    async def _handle_rejection(self, request: Request, violation_type: str):
        """Handle rejected CORS requests with appropriate response."""
        response = await self.app(request)
        response.status_code = 403
        self.logger.warning(f"CORS request rejected", extra={
            'origin': request.headers.get('origin', 'unknown'),
            'violation_type': violation_type,
            'path': request.url.path,
            'method': request.method
        })
        return response

def get_cors_middleware():
    """Create and configure the CORS middleware with environment-specific settings."""
    cors_config = {
        'allow_origins': ALLOWED_ORIGINS,
        'allow_methods': ALLOWED_METHODS,
        'allow_headers': ALLOWED_HEADERS,
        'allow_credentials': True,
        'max_age': 3600,
    }

    if settings.ENVIRONMENT == 'production':
        cors_config.update({
            'allow_origins': [origin for origin in ALLOWED_ORIGINS if not origin.endswith('.local')],
            'max_requests_per_hour': 1000
        })
    else:
        cors_config.update({
            'max_requests_per_hour': 5000
        })

    middleware = CORSLoggingMiddleware(
        CORSMiddleware(
            app=None,
            **cors_config
        ),
        config=cors_config
    )

    return middleware