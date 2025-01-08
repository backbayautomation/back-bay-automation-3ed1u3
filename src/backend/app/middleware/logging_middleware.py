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

    def __init__(self, app, config: dict = None):
        """Initialize logging middleware with structured logger and monitoring configuration."""
        super().__init__(app)
        self.logger = StructuredLogger("api.middleware")
        self.security_patterns = {
            "large_payload": 10 * 1024 * 1024,  # 10MB
            "suspicious_headers": ["x-forwarded-host", "x-custom-host"],
            "blocked_paths": ["/admin", "/internal"],
            "rate_limit": {
                "window": 3600,  # 1 hour
                "max_requests": 1000
            }
        }
        self.performance_metrics = {
            "response_time_threshold": 1000,  # ms
            "error_rate_window": 3600,  # 1 hour
            "error_count": 0,
            "request_count": 0
        }

    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request/response with comprehensive logging and monitoring."""
        try:
            # Generate or validate correlation ID
            correlation_id = request.headers.get("X-Correlation-ID") or get_correlation_id()
            set_correlation_id(correlation_id)

            # Start request timing
            start_time = time.perf_counter()

            # Log and analyze request
            await self.log_request(request)

            # Process request with error handling
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

            # Calculate processing time
            process_time = (time.perf_counter() - start_time) * 1000

            # Log response and update metrics
            self.log_response(response, process_time)

            # Add correlation headers
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

            # Update performance metrics
            self.performance_metrics["request_count"] += 1
            if response.status_code >= 500:
                self.performance_metrics["error_count"] += 1

            return response

        except Exception as e:
            self.logger.error(
                "Middleware error",
                extra={
                    "error": str(e),
                    "correlation_id": get_correlation_id()
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
            "correlation_id": get_correlation_id()
        }

        # Analyze security patterns
        security_analysis = self.analyze_security_patterns(request)
        if security_analysis.get("alerts"):
            self.logger.warning(
                "Security pattern detected",
                extra={
                    "security_alerts": security_analysis["alerts"],
                    **request_data
                }
            )

        # Log request with security context
        self.logger.info(
            "Incoming request",
            extra={
                **request_data,
                "security_analysis": security_analysis
            }
        )

    def log_response(self, response: Response, process_time: float) -> None:
        """Log response details with performance metrics."""
        response_data = {
            "status_code": response.status_code,
            "process_time_ms": process_time,
            "correlation_id": get_correlation_id()
        }

        # Check performance thresholds
        if process_time > self.performance_metrics["response_time_threshold"]:
            self.logger.warning(
                "Response time threshold exceeded",
                extra={
                    "threshold_ms": self.performance_metrics["response_time_threshold"],
                    **response_data
                }
            )

        # Calculate error rate
        error_rate = (
            self.performance_metrics["error_count"] /
            self.performance_metrics["request_count"]
            if self.performance_metrics["request_count"] > 0
            else 0
        )

        # Log response with metrics
        self.logger.info(
            "Response completed",
            extra={
                **response_data,
                "error_rate": error_rate
            }
        )

    def analyze_security_patterns(self, request: Request) -> dict:
        """Analyze request patterns for security monitoring."""
        alerts = []

        # Check payload size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.security_patterns["large_payload"]:
            alerts.append("large_payload_detected")

        # Check suspicious headers
        for header in self.security_patterns["suspicious_headers"]:
            if header in request.headers:
                alerts.append(f"suspicious_header_{header}")

        # Check blocked paths
        if any(blocked in request.url.path for blocked in self.security_patterns["blocked_paths"]):
            alerts.append("blocked_path_attempted")

        # Return security analysis
        return {
            "alerts": alerts if alerts else None,
            "risk_level": "high" if alerts else "low",
            "timestamp": time.time()
        }