"""
Logging configuration module for the AI-powered Product Catalog Search System.
Implements comprehensive logging infrastructure with Azure Monitor integration,
structured logging, and security audit capabilities.

Version: 1.0.0
"""

import os  # version: latest
import logging  # version: latest
from logging.handlers import RotatingFileHandler  # version: latest
from pythonjsonlogger import jsonlogger  # version: 2.0.0
from azure.monitor.opentelemetry import AzureMonitorTraceExporter  # version: 1.0.0

from .config import settings

# Environment-specific log levels
LOG_LEVELS = {
    "development": "DEBUG",
    "staging": "INFO",
    "production": "WARNING"
}

# Log format with correlation ID and environment tracking
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

        # Add environment context
        record.environment = settings['environment']

        # Add component/service name
        if not hasattr(record, 'component'):
            record.component = record.name

        # Format stack trace if present
        if record.exc_info:
            record.stack_trace = self.formatException(record.exc_info)
        else:
            record.stack_trace = ''

        # Mask sensitive data
        if hasattr(record, 'password'):
            record.password = '*****'
        if hasattr(record, 'connection_string'):
            record.connection_string = '*****'

        # Add security context
        for key, value in self.security_context.items():
            setattr(record, key, value)

        # Add performance metrics
        for key, value in self.performance_metrics.items():
            setattr(record, key, value)

        return super().format(record)

def configure_azure_monitor():
    """Sets up Azure Monitor integration for production logging with enhanced reliability."""
    try:
        connection_string = settings['azure'].get('monitor_connection_string')
        if not connection_string:
            logging.warning("Azure Monitor connection string not configured")
            return

        exporter = AzureMonitorTraceExporter(
            connection_string=connection_string,
            instrumentation_key=settings['azure'].get('instrumentation_key')
        )

        # Configure connection pooling
        exporter.http_client_options = {
            'timeout': 30.0,
            'max_retries': 3,
            'retry_on_timeout': True
        }

        # Set up custom dimensions
        exporter.add_telemetry_processor(lambda envelope: {
            'environment': settings['environment'],
            'component': 'catalog-search',
            'version': '1.0.0'
        })

        return exporter
    except Exception as e:
        logging.error(f"Failed to configure Azure Monitor: {str(e)}")
        return None

def setup_logging():
    """Initializes and configures application-wide logging settings with comprehensive monitoring integration."""
    # Get environment-specific log level
    log_level = getattr(logging, LOG_LEVELS.get(settings['environment'], 'INFO'))
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Create JSON formatter
    json_formatter = JsonFormatter(JSON_LOG_FORMAT)

    # Configure console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(json_formatter)
    root_logger.addHandler(console_handler)

    # Configure rotating file handler
    os.makedirs(os.path.dirname(LOG_FILE_PATH), exist_ok=True)
    file_handler = RotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT
    )
    file_handler.setFormatter(json_formatter)
    root_logger.addHandler(file_handler)

    # Configure Azure Monitor for production
    if settings['environment'] == 'production':
        azure_exporter = configure_azure_monitor()
        if azure_exporter:
            root_logger.info("Azure Monitor integration configured successfully")

def get_logger(module_name: str) -> logging.Logger:
    """Returns a configured logger instance for the specified module with enhanced tracking capabilities."""
    logger = logging.getLogger(module_name)
    
    # Set environment-specific log level
    logger.setLevel(getattr(logging, LOG_LEVELS.get(settings['environment'], 'INFO')))

    # Add correlation ID support
    logger.correlation_id = None

    # Configure component tagging
    logger.component = module_name

    # Enable performance tracking
    logger.performance_metrics = {}

    # Set up security context
    logger.security_context = {
        'user_id': None,
        'client_id': None,
        'ip_address': None
    }

    return logger

# Export logging configuration functions and formatter
__all__ = ['setup_logging', 'get_logger', 'JsonFormatter']