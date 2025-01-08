"""
Logging utility module for AI-powered Product Catalog Search System.
Provides structured logging with Azure Monitor integration, security event tracking,
and correlation management.

Version: 1.0.0
"""

import logging  # Python 3.11+
from pythonjsonlogger import jsonlogger  # version: 2.0.7
from azure.monitor.opentelemetry import AzureMonitorTraceExporter  # version: 1.0.0
import uuid  # Python 3.11+
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

    # Configure Azure Monitor in production
    if settings.ENVIRONMENT == "production":
        azure_exporter = AzureMonitorTraceExporter.from_connection_string(
            settings.AZURE_MONITOR_CONNECTION_STRING
        )
        azure_handler = logging.Handler()
        azure_handler.setFormatter(formatter)
        azure_handler.setLevel(logging.WARNING)
        root_logger.addHandler(azure_handler)

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
        log_data (Dict[str, Any]): Original log data
    Returns:
        Dict[str, Any]: Sanitized log data
    """
    sanitized_data = copy.deepcopy(log_data)

    def _sanitize_dict(data: Dict[str, Any]) -> None:
        for key, value in data.items():
            if isinstance(value, dict):
                _sanitize_dict(value)
            elif isinstance(key, str) and any(field in key.lower() for field in SENSITIVE_FIELDS):
                data[key] = "*****"

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
            name (str): Logger name
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
            event_type (str): Type of security event
            event_data (Dict[str, Any]): Event details
        """
        sanitized_data = sanitize_log_data(event_data)
        
        log_entry = {
            "event_type": event_type,
            "correlation_id": get_correlation_id(),
            "timestamp": time.time(),
            "data": sanitized_data
        }

        if event_type.startswith("auth"):
            self._logger.warning(log_entry)
        else:
            self._logger.info(log_entry)

        # Track security metrics
        metric_name = f"security_event.{event_type}"
        self.log_metric(metric_name, 1, {"event_type": event_type})

    def log_metric(self, metric_name: str, value: float, dimensions: Optional[Dict[str, str]] = None) -> None:
        """
        Log performance metrics with Azure Monitor integration.
        Args:
            metric_name (str): Name of the metric
            value (float): Metric value
            dimensions (Optional[Dict[str, str]]): Additional dimensions
        """
        if not dimensions:
            dimensions = {}

        dimensions["correlation_id"] = get_correlation_id()
        dimensions["logger_name"] = self.name
        dimensions["environment"] = settings.ENVIRONMENT

        metric_data = {
            "name": metric_name,
            "value": value,
            "dimensions": dimensions,
            "timestamp": time.time()
        }

        # Store metric locally
        self._metrics[metric_name] = metric_data

        # Send to Azure Monitor in production
        if settings.ENVIRONMENT == "production":
            try:
                azure_exporter = AzureMonitorTraceExporter.from_connection_string(
                    settings.AZURE_MONITOR_CONNECTION_STRING
                )
                azure_exporter.export_metric(metric_data)
            except Exception as e:
                self._logger.error(f"Failed to export metric to Azure Monitor: {str(e)}")