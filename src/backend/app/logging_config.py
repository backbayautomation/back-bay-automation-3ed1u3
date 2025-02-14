"""
Logging configuration module for the AI-powered Product Catalog Search System.
Implements comprehensive logging infrastructure with Azure Monitor integration,
structured logging, and security audit capabilities.

Version: 1.0.0
"""

import os  # version: latest
import logging  # version: 3.11+
from logging.handlers import RotatingFileHandler  # version: 3.11+
from pythonjsonlogger import jsonlogger  # version: 2.0.0
from azure.monitor.opentelemetry import AzureMonitorTraceExporter  # version: 1.0.0

from .config import settings

# Environment-specific log levels
LOG_LEVELS = {
    "development": "DEBUG",
    "staging": "INFO",
    "production": "WARNING"
}

# Log format with correlation ID and component tracking
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(correlation_id)s - %(environment)s - %(component)s - %(message)s"

# JSON log format with enhanced fields
JSON_LOG_FORMAT = "%(timestamp)s %(level)s %(name)s %(correlation_id)s %(environment)s %(component)s %(message)s %(stack_trace)s"

# Log file configuration
LOG_FILE_PATH = os.path.join(settings.get('LOG_DIR', 'logs'), 'app.log')
MAX_BYTES = 10485760  # 10MB
BACKUP_COUNT = 5

class JsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter for structured logging with enhanced fields and security features."""
    
    def __init__(self, format_string):
        """Initialize JSON formatter with enhanced formatting capabilities."""
        super().__init__(format_string)
        self.format_string = format_string
        self.security_context = {}
        self.performance_metrics = {}

    def format(self, record):
        """Formats log record as JSON with enhanced fields and security features."""
        # Add correlation ID if not present
        if not hasattr(record, 'correlation_id'):
            record.correlation_id = 'undefined'

        # Add environment tag
        record.environment = os.getenv('ENVIRONMENT', 'development')

        # Add component name
        if not hasattr(record, 'component'):
            record.component = record.name

        # Format stack trace if present
        if record.exc_info:
            record.stack_trace = self.formatException(record.exc_info)
        else:
            record.stack_trace = None

        # Apply data masking for sensitive information
        if hasattr(record, 'msg'):
            for sensitive in ['password', 'token', 'key', 'secret']:
                if sensitive in str(record.msg).lower():
                    record.msg = f'[MASKED {sensitive.upper()}]'

        # Add security context
        for key, value in self.security_context.items():
            setattr(record, key, value)

        # Add performance metrics
        for key, value in self.performance_metrics.items():
            setattr(record, key, value)

        return super().format(record)

def setup_logging():
    """Initializes and configures application-wide logging settings with comprehensive monitoring integration."""
    # Get environment-specific log level
    log_level = getattr(logging, LOG_LEVELS.get(os.getenv('ENVIRONMENT', 'development')))
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Create JSON formatter
    json_formatter = JsonFormatter(JSON_LOG_FORMAT)

    # Configure console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(json_formatter)
    console_handler.setLevel(log_level)
    root_logger.addHandler(console_handler)

    # Configure rotating file handler
    os.makedirs(os.path.dirname(LOG_FILE_PATH), exist_ok=True)
    file_handler = RotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding='utf-8'
    )
    file_handler.setFormatter(json_formatter)
    file_handler.setLevel(log_level)
    root_logger.addHandler(file_handler)

    # Configure Azure Monitor integration for production
    if os.getenv('ENVIRONMENT') == 'production':
        configure_azure_monitor()

def get_logger(module_name: str) -> logging.Logger:
    """Returns a configured logger instance for the specified module with enhanced tracking capabilities."""
    logger = logging.getLogger(module_name)
    
    # Set environment-specific level
    logger.setLevel(getattr(logging, LOG_LEVELS.get(os.getenv('ENVIRONMENT', 'development'))))
    
    # Add correlation ID support
    logger.correlation_id = None
    
    # Configure component tagging
    logger.component = module_name
    
    # Set up performance tracking
    logger.performance_metrics = {}
    
    # Enable security context
    logger.security_context = {}
    
    return logger

@staticmethod
def configure_azure_monitor():
    """Sets up Azure Monitor integration for production logging with enhanced reliability."""
    try:
        # Initialize Azure Monitor exporter with connection string
        exporter = AzureMonitorTraceExporter.from_connection_string(
            settings['azure']['application_insights']['connection_string']
        )

        # Configure connection pooling
        exporter.connection_pool_settings.max_connections = 100
        exporter.connection_pool_settings.timeout_seconds = 30

        # Set up custom dimensions
        exporter.add_telemetry_processor(lambda envelope: {
            'Environment': os.getenv('ENVIRONMENT'),
            'Component': envelope.tags.get('ai.cloud.role', 'undefined'),
            'CorrelationId': envelope.tags.get('ai.operation.id', 'undefined')
        })

        # Initialize performance metrics
        exporter.track_metric('ProcessingTime')
        exporter.track_metric('RequestCount')
        exporter.track_metric('ErrorCount')

        # Configure distributed tracing
        exporter.sampling_percentage = settings['azure']['application_insights']['sampling_percentage']

    except Exception as e:
        logging.error(f"Failed to configure Azure Monitor: {str(e)}")
        raise

# Export required components
__all__ = ['setup_logging', 'get_logger', 'JsonFormatter']