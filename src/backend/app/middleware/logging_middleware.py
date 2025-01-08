"""
FastAPI middleware component for comprehensive request/response logging, correlation tracking,
security monitoring, and Azure Monitor integration.

Version: 1.0.0
"""

import time  # Python 3.11+
from fastapi.middleware.base import BaseHTTPMiddleware  # version: ^0.103.0
from fastapi import Request  # version: ^0.103.0
from starlette.responses import Response  # version: ^0.27.0
from typing import Callable, Dict, Any
import uuid

from ..utils.logging import (
    StructuredLogger,
    get_correlation_id,
    set_correlation_id
)
from ..config import settings

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Advanced FastAPI middleware for request/response logging, security monitoring,
    and Azure Monitor integration with correlation tracking.
    """

    def __init__(self, app, config: Dict[str, Any] = None):
        """Initialize logging middleware with structured logger and monitoring configuration."""
        super().__init__(app)
        self.logger = StructuredLogger("api.middleware")
        self.config = config or {}
        
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

        # Alert thresholds
        self.alert_thresholds = {
            "slow_request_ms": 1000,
            "error_rate_threshold": 0.1,
            "suspicious_pattern_threshold": 10
        }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request/response with comprehensive logging and monitoring."""
        start_time = time.time()
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        
        # Set correlation context
        set_correlation_id(correlation_id)
        
        try:
            # Log and analyze incoming request
            await self.log_request(request)
            
            # Security pattern analysis
            security_analysis = self.analyze_security_patterns(request)
            if security_analysis.get("blocked", False):
                return Response(
                    content="Request blocked due to security policy",
                    status_code=403
                )
            
            # Process request
            response = await call_next(request)
            
            # Calculate processing time
            process_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            # Update performance metrics
            self.performance_metrics["request_count"] += 1
            self.performance_metrics["total_processing_time"] += process_time
            
            if process_time > self.alert_thresholds["slow_request_ms"]:
                self.performance_metrics["slow_requests"].append({
                    "path": request.url.path,
                    "method": request.method,
                    "time": process_time,
                    "timestamp": time.time()
                })
            
            # Log response
            self.log_response(response, process_time)
            
            # Add correlation headers
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
            
            return response
            
        except Exception as e:
            self.performance_metrics["error_count"] += 1
            process_time = (time.time() - start_time) * 1000
            
            self.logger.error(
                "Request processing failed",
                extra={
                    "error": str(e),
                    "correlation_id": correlation_id,
                    "path": request.url.path,
                    "method": request.method,
                    "process_time": process_time
                }
            )
            
            raise

    async def log_request(self, request: Request) -> None:
        """Log incoming request details with security analysis."""
        # Extract request details
        request_data = {
            "method": request.method,
            "path": request.url.path,
            "query_params": str(request.query_params),
            "client_host": request.client.host if request.client else None,
            "correlation_id": get_correlation_id(),
            "user_agent": request.headers.get("user-agent"),
            "content_length": request.headers.get("content-length"),
            "accept": request.headers.get("accept")
        }

        # Security context
        security_context = self.analyze_security_patterns(request)
        request_data["security_context"] = security_context

        self.logger.info(
            "Incoming request",
            extra=request_data
        )

    def log_response(self, response: Response, process_time: float) -> None:
        """Log response details with performance metrics."""
        response_data = {
            "status_code": response.status_code,
            "correlation_id": get_correlation_id(),
            "process_time_ms": process_time,
            "content_type": response.headers.get("content-type"),
            "content_length": response.headers.get("content-length")
        }

        # Add performance context
        if process_time > self.alert_thresholds["slow_request_ms"]:
            response_data["performance_alert"] = "slow_request"
            
        # Calculate error rate
        error_rate = (
            self.performance_metrics["error_count"] /
            self.performance_metrics["request_count"]
            if self.performance_metrics["request_count"] > 0 else 0
        )
        
        if error_rate > self.alert_thresholds["error_rate_threshold"]:
            response_data["error_rate_alert"] = error_rate

        self.logger.info(
            "Outgoing response",
            extra=response_data
        )

    def analyze_security_patterns(self, request: Request) -> Dict[str, Any]:
        """Analyze request patterns for security monitoring."""
        client_ip = request.client.host if request.client else None
        
        security_analysis = {
            "suspicious_patterns": False,
            "rate_limit_exceeded": False,
            "blocked": False
        }

        if client_ip:
            # Check if IP is blocked
            if client_ip in self.security_patterns["blocked_ips"]:
                security_analysis["blocked"] = True
                return security_analysis

            # Rate limiting check
            current_time = time.time()
            if client_ip in self.security_patterns["rate_limits"]:
                requests = self.security_patterns["rate_limits"][client_ip]
                # Clean old requests
                requests = [t for t in requests if current_time - t < 3600]
                if len(requests) > 1000:  # 1000 requests per hour limit
                    security_analysis["rate_limit_exceeded"] = True
                requests.append(current_time)
                self.security_patterns["rate_limits"][client_ip] = requests
            else:
                self.security_patterns["rate_limits"][client_ip] = [current_time]

            # Suspicious pattern detection
            suspicious_patterns = [
                request.url.path.count("../") > 0,  # Path traversal attempt
                request.headers.get("user-agent", "").startswith("curl/"),  # Direct API access
                len(request.url.path) > 2000,  # Unusually long URL
                request.headers.get("content-length", "0").isdigit() and 
                int(request.headers.get("content-length", "0")) > 10 * 1024 * 1024  # Large payload
            ]

            if any(suspicious_patterns):
                security_analysis["suspicious_patterns"] = True
                self.security_patterns["suspicious_patterns"].add(client_ip)

                if len([ip for ip in self.security_patterns["suspicious_patterns"] 
                       if ip == client_ip]) > self.alert_thresholds["suspicious_pattern_threshold"]:
                    security_analysis["blocked"] = True
                    self.security_patterns["blocked_ips"].add(client_ip)

        return security_analysis