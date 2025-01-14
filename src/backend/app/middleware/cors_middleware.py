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
ALLOWED_ORIGINS = settings.SECURITY_CONFIG['cors']['cors_origins']
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
    """Enhanced CORS middleware with comprehensive security monitoring and logging."""

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

    async def __call__(self, request: Request, call_next: Any):
        """Process CORS requests with enhanced security checks and monitoring."""
        start_time = datetime.now()
        origin = request.headers.get('origin')
        client_id = request.headers.get('x-client-id')

        # Track active requests
        if origin:
            self.active_requests.labels(origin=origin).inc()

        try:
            # Validate origin and security policies
            security_check = await self.check_security_policy(request)
            
            if not security_check['is_valid']:
                VIOLATION_METRICS.labels(
                    origin=origin or 'unknown',
                    type=security_check['violation_type']
                ).inc()
                
                self.logger.warning(
                    "CORS violation detected",
                    extra={
                        'origin': origin,
                        'client_id': client_id,
                        'violation_type': security_check['violation_type'],
                        'request_path': request.url.path
                    }
                )
                
                return await self.handle_cors_violation(security_check)

            # Process the request
            response = await call_next(request)

            # Add security headers
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['X-XSS-Protection'] = '1; mode=block'

            # Update metrics
            CORS_METRICS.labels(
                origin=origin or 'unknown',
                status='success'
            ).inc()

            # Log successful request
            self.logger.info(
                "CORS request processed",
                extra={
                    'origin': origin,
                    'client_id': client_id,
                    'duration_ms': (datetime.now() - start_time).total_seconds() * 1000,
                    'status_code': response.status_code
                }
            )

            return response

        except Exception as e:
            self.logger.error(
                "CORS processing error",
                extra={
                    'origin': origin,
                    'client_id': client_id,
                    'error': str(e)
                },
                exc_info=True
            )
            CORS_METRICS.labels(
                origin=origin or 'unknown',
                status='error'
            ).inc()
            raise

        finally:
            if origin:
                self.active_requests.labels(origin=origin).dec()

    async def check_security_policy(self, request: Request) -> Dict[str, Any]:
        """Validate request against security policies with enhanced checks."""
        origin = request.headers.get('origin')
        client_id = request.headers.get('x-client-id')

        result = {
            'is_valid': False,
            'violation_type': None
        }

        # Skip validation for development environment
        if settings.ENVIRONMENT == 'development':
            result['is_valid'] = True
            return result

        # Validate origin
        if not origin or origin not in ALLOWED_ORIGINS:
            result['violation_type'] = 'invalid_origin'
            return result

        # Check rate limiting using origin cache
        cache_key = f"{origin}:{client_id}"
        current_time = datetime.now()
        
        if cache_key in self.origin_cache:
            cache_data = self.origin_cache[cache_key]
            request_count = cache_data['count']
            first_request_time = cache_data['first_request']

            # Reset counter if outside the rate limit window
            if (current_time - first_request_time).total_seconds() > 3600:
                self.origin_cache[cache_key] = {
                    'count': 1,
                    'first_request': current_time
                }
            elif request_count >= settings.RATE_LIMIT_REQUESTS:
                result['violation_type'] = 'rate_limit_exceeded'
                return result
            else:
                self.origin_cache[cache_key]['count'] += 1
        else:
            self.origin_cache[cache_key] = {
                'count': 1,
                'first_request': current_time
            }

        result['is_valid'] = True
        return result

    async def handle_cors_violation(self, security_check: Dict[str, Any]):
        """Handle CORS violations with appropriate responses."""
        status_code = 403 if security_check['violation_type'] == 'invalid_origin' else 429
        return {
            'status_code': status_code,
            'detail': f"CORS policy violation: {security_check['violation_type']}"
        }


def get_cors_middleware():
    """Create and configure CORS middleware with environment-specific settings."""
    return CORSMiddleware(
        app=None,  # Will be set by FastAPI
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=ALLOWED_METHODS,
        allow_headers=ALLOWED_HEADERS,
        expose_headers=['X-Total-Count'],
        max_age=3600
    )