"""
Enhanced logging utility module for AI-powered Product Catalog Search System.
Provides structured logging with Azure Monitor integration, security event tracking,
and correlation management.

Version: 1.0.0
"""

import logging  # Python 3.11+
from pythonjsonlogger import jsonlogger  # version: 2.0.7
from azure.monitor.opentelemetry import configure_azure_monitor  # version: 1.0.0
from uuid import uuid4  # Python 3.11+
from contextvars import ContextVar  # Python 3.11+
from typing import Dict, Any, Optional  # Python 3.11+
import copy
import time

from ..config import settings

# Global context for correlation ID tracking
CORRELATION_ID_CONTEXT: ContextVar[str] = ContextVar('correlation_id', default=None)

# Environment-specific log levels
LOG_LEVELS = {
    "development": "DEBUG",
    "staging": "INFO",
    "production": "WARNING"
}

# Enhanced JSON log format with correlation ID
JSON_LOG_FORMAT = "%(timestamp)s %(correlation_id)s %(level)s %(name)s %(message)s %(extra)s"

# Fields to be masked in logs
SENSITIVE_FIELDS = ["password", "token", "api_key", "secret"]

def setup_structured_logging() -> None:
    """
    Initialize enhanced structured logging with environment-specific configuration
    and Azure Monitor integration.
    """
    # Configure root logger with environment-specific level
    root_logger = logging.getLogger()
    log_level = getattr(logging, LOG_LEVELS.get(settings.ENVIRONMENT, "INFO"))
    root_logger.setLevel(log_level)

    # Create JSON formatter with enhanced format
    formatter = jsonlogger.JsonFormatter(
        JSON_LOG_FORMAT,
        timestamp=True,
        json_ensure_ascii=False
    )

    # Configure console handler with sanitization
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Initialize Azure Monitor in production
    if settings.ENVIRONMENT == "production":
        configure_azure_monitor(
            connection_string=settings.AZURE_MONITOR_CONNECTION_STRING,
            service_name="catalog-search",
            service_version="1.0.0"
        )

    # Configure file handler for non-development environments
    if settings.ENVIRONMENT != "development":
        file_handler = logging.handlers.RotatingFileHandler(
            filename="logs/application.log",
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

def get_correlation_id() -> str:
    """
    Retrieve or generate correlation ID with enhanced validation.
    Returns:
        str: Current correlation ID or new UUID4
    """
    correlation_id = CORRELATION_ID_CONTEXT.get()
    if not correlation_id:
        correlation_id = str(uuid4())
        CORRELATION_ID_CONTEXT.set(correlation_id)
    return correlation_id

def sanitize_log_data(log_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize sensitive information from log data.
    Args:
        log_data: Dictionary containing log data
    Returns:
        Dict[str, Any]: Sanitized log data
    """
    sanitized_data = copy.deepcopy(log_data)
    
    def _sanitize_dict(data: Dict[str, Any]) -> None:
        for key, value in data.items():
            if isinstance(value, dict):
                _sanitize_dict(value)
            elif any(sensitive in key.lower() for sensitive in SENSITIVE_FIELDS):
                data[key] = "[REDACTED]"
    
    _sanitize_dict(sanitized_data)
    return sanitized_data

class StructuredLogger:
    """
    Enhanced logger class with structured logging, security tracking,
    and performance monitoring.
    """

    def __init__(self, name: str):
        """
        Initialize enhanced structured logger.
        Args:
            name: Logger name
        """
        self._logger = logging.getLogger(name)
        self.name = name
        self._metrics = {}

        # Configure JSON formatting
        formatter = jsonlogger.JsonFormatter(
            JSON_LOG_FORMAT,
            timestamp=True,
            json_ensure_ascii=False
        )
        
        for handler in self._logger.handlers:
            handler.setFormatter(formatter)

    def log_security_event(self, event_type: str, event_data: Dict[str, Any]) -> None:
        """
        Log security-related events with enhanced tracking.
        Args:
            event_type: Type of security event
            event_data: Event details
        """
        sanitized_data = sanitize_log_data(event_data)
        log_entry = {
            "event_type": event_type,
            "correlation_id": get_correlation_id(),
            "timestamp": time.time(),
            "data": sanitized_data
        }

        if event_type.startswith("error"):
            self._logger.error(f"Security event: {event_type}", extra=log_entry)
        else:
            self._logger.info(f"Security event: {event_type}", extra=log_entry)

        # Track security metrics if in production
        if settings.ENVIRONMENT == "production":
            self.log_metric(
                f"security_event_{event_type}",
                1.0,
                {"event_type": event_type}
            )

    def log_metric(self, metric_name: str, value: float, dimensions: Optional[Dict[str, str]] = None) -> None:
        """
        Log performance metrics with Azure Monitor integration.
        Args:
            metric_name: Name of the metric
            value: Metric value
            dimensions: Additional metric dimensions
        """
        if not metric_name:
            raise ValueError("Metric name cannot be empty")

        metric_data = {
            "name": metric_name,
            "value": value,
            "dimensions": dimensions or {},
            "correlation_id": get_correlation_id(),
            "timestamp": time.time()
        }

        # Store metric locally
        self._metrics[metric_name] = metric_data

        # Send to Azure Monitor in production
        if settings.ENVIRONMENT == "production":
            try:
                from azure.monitor.opentelemetry import metrics
                meter = metrics.get_meter("catalog-search")
                metric_counter = meter.create_counter(metric_name)
                metric_counter.add(value, dimensions)
            except Exception as e:
                self._logger.error(f"Failed to send metric to Azure Monitor: {str(e)}")