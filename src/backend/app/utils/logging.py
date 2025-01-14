"""
Enhanced logging utility module for AI-powered Product Catalog Search System.
Provides structured logging with Azure Monitor integration, security event tracking,
and correlation management.

Version: 1.0.0
"""

import logging  # Python 3.11+
from pythonjsonlogger import jsonlogger  # version: 2.0.7
from azure.monitor.opentelemetry import configure_azure_monitor  # version: 1.0.0
import uuid  # Python 3.11+
from contextvars import ContextVar  # Python 3.11+
from typing import Dict, Any, Optional  # Python 3.11+

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
    root_logger.setLevel(LOG_LEVELS.get(settings.ENVIRONMENT, "INFO"))

    # Create JSON formatter with enhanced format
    json_formatter = jsonlogger.JsonFormatter(
        fmt=JSON_LOG_FORMAT,
        timestamp=True
    )

    # Configure console handler with sanitization
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(json_formatter)
    root_logger.addHandler(console_handler)

    # Initialize Azure Monitor in production
    if settings.ENVIRONMENT == "production":
        configure_azure_monitor(
            connection_string=settings.AZURE_MONITOR_CONNECTION_STRING,
            service_name="catalog-search-system"
        )

    # Configure file handler with rotation for non-development environments
    if settings.ENVIRONMENT != "development":
        file_handler = logging.handlers.RotatingFileHandler(
            filename="logs/application.log",
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(json_formatter)
        root_logger.addHandler(file_handler)

def get_correlation_id() -> str:
    """
    Retrieve or generate correlation ID with enhanced validation.
    Returns:
        str: Current correlation ID or new UUID4
    """
    correlation_id = CORRELATION_ID_CONTEXT.get()
    if not correlation_id:
        correlation_id = str(uuid.uuid4())
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
    sanitized_data = log_data.copy()
    
    def _sanitize_dict(data: Dict[str, Any]) -> None:
        for key, value in data.items():
            if isinstance(value, dict):
                _sanitize_dict(value)
            elif any(sensitive in key.lower() for sensitive in SENSITIVE_FIELDS):
                data[key] = "********"
    
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
            name: Logger name for module identification
        """
        self._logger = logging.getLogger(name)
        self.name = name
        self._metrics = {}

        # Configure Azure Monitor integration for production
        if settings.ENVIRONMENT == "production":
            self._setup_azure_monitor()

    def _setup_azure_monitor(self) -> None:
        """Configure Azure Monitor integration for metrics and traces."""
        configure_azure_monitor(
            connection_string=settings.AZURE_MONITOR_CONNECTION_STRING,
            service_name=self.name
        )

    def log_security_event(self, event_type: str, event_data: Dict[str, Any]) -> None:
        """
        Log security-related events with enhanced tracking.
        Args:
            event_type: Type of security event
            event_data: Event details and context
        """
        sanitized_data = sanitize_log_data(event_data)
        correlation_id = get_correlation_id()
        
        log_entry = {
            "event_type": event_type,
            "correlation_id": correlation_id,
            "data": sanitized_data,
            "timestamp": logging.Formatter().formatTime(logging.LogRecord("", 0, "", 0, None, None, None))
        }

        # Log with appropriate severity based on event type
        if "error" in event_type.lower() or "failure" in event_type.lower():
            self._logger.error(f"Security event: {event_type}", extra=log_entry)
        else:
            self._logger.info(f"Security event: {event_type}", extra=log_entry)

    def log_metric(self, metric_name: str, value: float, dimensions: Optional[Dict[str, str]] = None) -> None:
        """
        Log performance metrics with Azure Monitor integration.
        Args:
            metric_name: Name of the metric
            value: Metric value
            dimensions: Optional metric dimensions/tags
        """
        correlation_id = get_correlation_id()
        
        metric_data = {
            "metric_name": metric_name,
            "value": value,
            "correlation_id": correlation_id,
            "dimensions": dimensions or {}
        }

        # Store metric locally
        self._metrics[metric_name] = metric_data

        # Log metric
        self._logger.info(
            f"Metric recorded: {metric_name}",
            extra={"metric": metric_data}
        )

        # Send to Azure Monitor in production
        if settings.ENVIRONMENT == "production":
            try:
                from azure.monitor.opentelemetry import metrics
                metrics.record_metric(
                    name=metric_name,
                    value=value,
                    dimensions=dimensions
                )
            except Exception as e:
                self._logger.error(f"Failed to send metric to Azure Monitor: {str(e)}")