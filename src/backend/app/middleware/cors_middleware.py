"""
Enhanced CORS middleware implementation with security monitoring and metrics collection
for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import Request  # version: 0.103.0
from fastapi.middleware.cors import CORSMiddleware  # version: 0.103.0
from prometheus_client import Counter, Gauge  # version: 0.17.1

from ..core.config import settings

# Global constants for CORS configuration
ALLOWED_ORIGINS = settings.SECURITY_CONFIG['cors_origins']
ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'X-Client-ID', 'X-Correlation-ID']

# Prometheus metrics for CORS monitoring
CORS_METRICS = Counter('cors_requests_total', 'Total CORS requests', ['origin', 'status'])
VIOLATION_METRICS = Counter('cors_violations_total', 'Total CORS violations', ['origin', 'type'])
ACTIVE_REQUESTS = Gauge('cors_active_requests', 'Active CORS requests', ['origin'])

# Configure logger for CORS events
logger = logging.getLogger(__name__)

class CORSLoggingMiddleware:
    """Enhanced middleware for CORS logging, security monitoring, and metrics collection."""

    def __init__(self, app: Any, config: Dict[str, Any]):
        """Initialize the enhanced CORS middleware with monitoring capabilities."""
        self.app = app
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.origin_cache: Dict[str, Dict[str, Any]] = {}
        
        # Initialize rate limiting
        self.rate_limit = settings.SECURITY_CONFIG['rate_limit_requests']
        self.rate_period = settings.SECURITY_CONFIG['rate_limit_period']

    async def __call__(self, request: Request, call_next: Any):
        """Process CORS requests with comprehensive security checks and monitoring."""
        origin = request.headers.get('origin')
        client_id = request.headers.get('x-client-id')
        
        # Track active requests
        if origin:
            ACTIVE_REQUESTS.labels(origin=origin).inc()
        
        try:
            # Validate origin and security policies
            security_check = await self.check_security_policy(request)
            
            if not security_check['is_valid']:
                VIOLATION_METRICS.labels(
                    origin=origin or 'unknown',
                    type=security_check['violation_type']
                ).inc()
                
                self.logger.warning(
                    "CORS security policy violation",
                    extra={
                        'origin': origin,
                        'client_id': client_id,
                        'violation_type': security_check['violation_type'],
                        'request_path': request.url.path
                    }
                )
                
                return await self.handle_violation(security_check)

            # Process the request
            start_time = datetime.now()
            response = await call_next(request)
            processing_time = (datetime.now() - start_time).total_seconds()

            # Update metrics
            CORS_METRICS.labels(
                origin=origin or 'unknown',
                status=response.status_code
            ).inc()

            # Log successful request
            self.logger.info(
                "CORS request processed",
                extra={
                    'origin': origin,
                    'client_id': client_id,
                    'status_code': response.status_code,
                    'processing_time': processing_time,
                    'request_path': request.url.path
                }
            )

            return response

        except Exception as e:
            self.logger.error(
                "CORS processing error",
                extra={
                    'origin': origin,
                    'client_id': client_id,
                    'error': str(e),
                    'request_path': request.url.path
                },
                exc_info=True
            )
            raise
        
        finally:
            if origin:
                ACTIVE_REQUESTS.labels(origin=origin).dec()

    async def check_security_policy(self, request: Request) -> Dict[str, Any]:
        """Validate request against security policies and update metrics."""
        origin = request.headers.get('origin')
        client_id = request.headers.get('x-client-id')

        # Basic validation
        if not origin:
            return {
                'is_valid': False,
                'violation_type': 'missing_origin'
            }

        # Check against allowed origins
        if origin not in ALLOWED_ORIGINS and '*' not in ALLOWED_ORIGINS:
            return {
                'is_valid': False,
                'violation_type': 'invalid_origin'
            }

        # Rate limiting check
        cache_key = f"{origin}:{client_id}" if client_id else origin
        if cache_key in self.origin_cache:
            cache_data = self.origin_cache[cache_key]
            if (datetime.now() - cache_data['timestamp']).total_seconds() < self.rate_period:
                if cache_data['count'] >= self.rate_limit:
                    return {
                        'is_valid': False,
                        'violation_type': 'rate_limit_exceeded'
                    }
                cache_data['count'] += 1
            else:
                cache_data.update({'count': 1, 'timestamp': datetime.now()})
        else:
            self.origin_cache[cache_key] = {
                'count': 1,
                'timestamp': datetime.now()
            }

        return {'is_valid': True}

    async def handle_violation(self, security_check: Dict[str, Any]):
        """Handle CORS security policy violations."""
        return {
            'status_code': 403,
            'detail': f"CORS policy violation: {security_check['violation_type']}"
        }

def get_cors_middleware():
    """Create and configure the CORS middleware with environment-specific settings."""
    middleware = CORSMiddleware(
        app=None,  # Will be set by FastAPI
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=ALLOWED_METHODS,
        allow_headers=ALLOWED_HEADERS,
        max_age=3600,  # Cache preflight requests for 1 hour
        expose_headers=['X-Request-ID']
    )

    return CORSLoggingMiddleware(
        app=middleware,
        config={
            'environment': settings.ENVIRONMENT,
            'debug': settings.DEBUG
        }
    )