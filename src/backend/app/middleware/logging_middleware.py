"""
FastAPI middleware component providing comprehensive request/response logging,
correlation ID tracking, security pattern monitoring, and Azure Monitor integration.

Version: 1.0.0
"""

import time  # Python 3.11+
from fastapi.middleware.base import BaseHTTPMiddleware  # version: ^0.103.0
from fastapi import Request  # version: ^0.103.0
from starlette.responses import Response  # version: ^0.27.0

from ..utils.logging import (
    StructuredLogger,
    get_correlation_id,
    set_correlation_id
)
from ..config import settings

class LoggingMiddleware(BaseHTTPMiddleware):
    """Advanced FastAPI middleware for request/response logging, security monitoring, and Azure Monitor integration."""

    def __init__(self, app):
        """Initialize logging middleware with structured logger and monitoring configuration."""
        super().__init__(app)
        self.logger = StructuredLogger("api.middleware.logging")
        
        # Initialize security pattern monitoring
        self.security_patterns = {
            "rate_limits": {},
            "suspicious_patterns": set(),
            "blocked_ips": set()
        }
        
        # Initialize performance metrics
        self.performance_metrics = {
            "request_count": 0,
            "error_count": 0,
            "total_processing_time": 0,
            "slow_requests": []
        }

        # Configure alert thresholds
        self.alert_thresholds = {
            "slow_request_ms": 1000,
            "error_rate_threshold": 0.05,
            "suspicious_pattern_threshold": 10
        }

    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request/response with comprehensive logging and monitoring."""
        start_time = time.perf_counter()
        correlation_id = request.headers.get("X-Correlation-ID") or get_correlation_id()
        
        try:
            # Set correlation ID in context
            set_correlation_id(correlation_id)
            
            # Log and analyze incoming request
            await self.log_request(request)
            
            # Process request and handle errors
            try:
                response = await call_next(request)
            except Exception as e:
                self.logger.error(
                    "Request processing error",
                    extra={
                        "error": str(e),
                        "correlation_id": correlation_id,
                        "path": request.url.path
                    }
                )
                raise
            
            # Calculate processing time and update metrics
            process_time = time.perf_counter() - start_time
            
            # Log response and update performance metrics
            self.log_response(response, process_time)
            
            # Add correlation and tracking headers
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            self.performance_metrics["error_count"] += 1
            raise
        
        finally:
            # Update request metrics
            self.performance_metrics["request_count"] += 1
            self.performance_metrics["total_processing_time"] += time.perf_counter() - start_time

    async def log_request(self, request: Request) -> None:
        """Log incoming request details with security analysis."""
        # Extract request details
        client_ip = request.client.host
        method = request.method
        path = request.url.path
        headers = dict(request.headers)
        
        # Analyze security patterns
        security_analysis = self.analyze_security_patterns(request)
        
        # Log request with correlation ID
        self.logger.info(
            "Incoming request",
            extra={
                "correlation_id": get_correlation_id(),
                "method": method,
                "path": path,
                "client_ip": client_ip,
                "security_analysis": security_analysis
            }
        )

    def log_response(self, response: Response, process_time: float) -> None:
        """Log response details with performance metrics."""
        # Check for slow requests
        if process_time > self.alert_thresholds["slow_request_ms"] / 1000:
            self.performance_metrics["slow_requests"].append({
                "correlation_id": get_correlation_id(),
                "process_time": process_time
            })
        
        # Log response details
        self.logger.info(
            "Response processed",
            extra={
                "correlation_id": get_correlation_id(),
                "status_code": response.status_code,
                "process_time": process_time,
                "content_length": len(response.body) if hasattr(response, "body") else 0
            }
        )
        
        # Log performance metrics to Azure Monitor in production
        if settings.ENVIRONMENT == "production":
            self.logger.log_metric(
                "request_processing_time",
                process_time,
                {
                    "correlation_id": get_correlation_id(),
                    "status_code": response.status_code
                }
            )

    def analyze_security_patterns(self, request: Request) -> dict:
        """Analyze request patterns for security monitoring."""
        client_ip = request.client.host
        current_time = time.time()
        
        # Check rate limits
        if client_ip in self.security_patterns["rate_limits"]:
            requests = self.security_patterns["rate_limits"][client_ip]
            requests = [t for t in requests if current_time - t < 3600]  # Keep last hour
            if len(requests) > settings.RATE_LIMIT_REQUESTS:
                self.security_patterns["blocked_ips"].add(client_ip)
        
        # Update rate limit tracking
        if client_ip not in self.security_patterns["rate_limits"]:
            self.security_patterns["rate_limits"][client_ip] = []
        self.security_patterns["rate_limits"][client_ip].append(current_time)
        
        # Analyze request patterns
        analysis = {
            "rate_limited": client_ip in self.security_patterns["blocked_ips"],
            "request_count": len(self.security_patterns["rate_limits"].get(client_ip, [])),
            "suspicious": False
        }
        
        # Check payload size
        if request.headers.get("content-length"):
            content_length = int(request.headers["content-length"])
            if content_length > 10 * 1024 * 1024:  # 10MB
                analysis["suspicious"] = True
                analysis["reason"] = "large_payload"
        
        return analysis