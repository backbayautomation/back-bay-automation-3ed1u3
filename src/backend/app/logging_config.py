"""
Logging configuration module for the AI-powered Product Catalog Search System.
Implements comprehensive logging with Azure Monitor integration, structured logging,
and security audit capabilities.

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
        # Extract base log record fields
        log_dict = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'name': record.name,
            'message': record.getMessage(),
            'environment': getattr(record, 'environment', settings.get('ENVIRONMENT', 'development')),
            'component': getattr(record, 'component', 'unknown'),
            'correlation_id': getattr(record, 'correlation_id', 'unknown')
        }

        # Add stack trace for errors
        if record.exc_info:
            log_dict['stack_trace'] = self.formatException(record.exc_info)

        # Add security context
        if hasattr(record, 'security_context'):
            log_dict.update(record.security_context)

        # Add performance metrics
        if hasattr(record, 'performance_metrics'):
            log_dict.update(record.performance_metrics)

        # Mask sensitive data
        self._mask_sensitive_data(log_dict)

        return self.serialize(log_dict)

    def _mask_sensitive_data(self, log_dict):
        """Masks sensitive data in log entries."""
        sensitive_fields = ['password', 'token', 'key', 'secret', 'credential']
        for key in log_dict:
            if any(field in key.lower() for field in sensitive_fields):
                log_dict[key] = '********'

def setup_logging():
    """Initializes and configures application-wide logging settings with comprehensive monitoring integration."""
    # Get environment-specific log level
    log_level = getattr(logging, LOG_LEVELS.get(
        settings.get('ENVIRONMENT', 'development').lower(),
        'INFO'
    ))

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
    file_handler = RotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding='utf-8'
    )
    file_handler.setFormatter(json_formatter)
    root_logger.addHandler(file_handler)

    # Configure Azure Monitor integration for production
    if settings.get('ENVIRONMENT') == 'production':
        configure_azure_monitor()

def get_logger(module_name: str) -> logging.Logger:
    """Returns a configured logger instance for the specified module with enhanced tracking capabilities."""
    logger = logging.getLogger(module_name)
    
    # Set environment-specific configuration
    logger.setLevel(LOG_LEVELS.get(
        settings.get('ENVIRONMENT', 'development').lower(),
        'INFO'
    ))

    # Add correlation ID support
    logger = logging.LoggerAdapter(logger, {
        'correlation_id': 'unknown',
        'environment': settings.get('ENVIRONMENT', 'development'),
        'component': module_name
    })

    return logger

@staticmethod
def configure_azure_monitor():
    """Sets up Azure Monitor integration for production logging with enhanced reliability."""
    try:
        # Initialize Azure Monitor exporter
        exporter = AzureMonitorTraceExporter(
            connection_string=settings['azure']['application_insights']['connection_string']
        )

        # Configure custom dimensions
        exporter.add_telemetry_processor(lambda envelope: {
            envelope.tags['ai.cloud.role'] = 'catalog-search-api',
            envelope.tags['ai.cloud.roleInstance'] = os.getenv('HOSTNAME', 'unknown')
        })

        # Configure sampling rate
        sampling_rate = 1.0 if settings.get('ENVIRONMENT') != 'production' else 0.1
        exporter.sampling_rate = sampling_rate

        # Initialize trace provider
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        trace_provider = TracerProvider()
        trace_provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(trace_provider)

    except Exception as e:
        logging.error(f"Failed to configure Azure Monitor: {str(e)}")