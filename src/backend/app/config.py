"""
Configuration module for the AI-powered Product Catalog Search System.
Implements thread-safe singleton pattern for settings management with secure defaults.

Version: 1.0.0
"""

import os  # version: latest
import logging  # version: latest
import json  # version: latest
import threading  # version: latest
from cryptography.fernet import Fernet  # version: 41.0.0

from .constants import DocumentStatus
from .core.config import core_settings

# Global constants with secure defaults
ENV = os.getenv('ENVIRONMENT', 'development')
DEBUG = ENV == 'development'
APP_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(APP_DIR)

# Thread-safe singleton implementation
_settings_lock = threading.Lock()
_instance = None

class Settings:
    """Thread-safe singleton class for managing application settings with secure defaults."""
    
    def __init__(self):
        """Initialize settings singleton with thread-safe implementation."""
        self._settings = {}
        self._initialized = False
        self._lock = threading.Lock()
        
        # Initialize settings and logging
        self._settings = self.load_settings()
        configure_logging(self._settings)
        self._initialized = True

    @classmethod
    def get_instance(cls):
        """Get or create singleton instance with thread safety."""
        global _instance
        if not _instance:
            with _settings_lock:
                if not _instance:
                    _instance = cls()
        return _instance

    def load_settings(self):
        """Load and validate settings from environment and core configuration."""
        settings = {}
        
        # Load core settings with secure defaults
        settings['database'] = core_settings.get_database_settings()
        settings['azure'] = core_settings.get_azure_settings()
        settings['vector_search'] = core_settings.get_vector_search_settings()
        
        # Environment-specific overrides
        settings['environment'] = ENV
        settings['debug'] = DEBUG
        settings['app_dir'] = APP_DIR
        settings['document_statuses'] = {
            'pending': DocumentStatus.PENDING.value,
            'processing': DocumentStatus.PROCESSING.value,
            'completed': DocumentStatus.COMPLETED.value,
            'failed': DocumentStatus.FAILED.value
        }
        
        # Security settings with secure defaults
        settings['security'] = {
            'encryption_key': os.getenv('ENCRYPTION_KEY'),
            'ssl_verify': True if ENV != 'development' else False,
            'secure_headers': True,
            'content_security_policy': True,
            'xss_protection': True,
            'hsts_enabled': True if ENV != 'development' else False
        }
        
        # Validate all settings
        if not self.validate_settings(settings):
            raise ValueError("Invalid configuration settings detected")
            
        # Encrypt sensitive values
        if settings['security']['encryption_key']:
            fernet = Fernet(settings['security']['encryption_key'].encode())
            for key in settings['database']:
                if key in ['password', 'connection_string']:
                    settings['database'][key] = fernet.encrypt(
                        settings['database'][key].encode()
                    ).decode()
        
        return settings

    def validate_settings(self, settings):
        """Validate all settings against defined schemas and security requirements."""
        try:
            # Required fields validation
            required_sections = ['database', 'azure', 'vector_search', 'security']
            for section in required_sections:
                if section not in settings:
                    raise ValueError(f"Missing required section: {section}")
            
            # Database configuration validation
            db_required = ['host', 'port', 'database', 'username']
            for field in db_required:
                if field not in settings['database']:
                    raise ValueError(f"Missing required database field: {field}")
            
            # Azure configuration validation
            azure_required = ['tenant_id', 'client_id', 'storage_account']
            for field in azure_required:
                if field not in settings['azure']:
                    raise ValueError(f"Missing required Azure field: {field}")
            
            # Vector search configuration validation
            vector_required = ['dimension', 'similarity_threshold', 'top_k_results']
            for field in vector_required:
                if field not in settings['vector_search']:
                    raise ValueError(f"Missing required vector search field: {field}")
            
            # Security validation
            if ENV != 'development':
                if not settings['security']['ssl_verify']:
                    raise ValueError("SSL verification must be enabled in non-development environments")
                if not settings['security']['hsts_enabled']:
                    raise ValueError("HSTS must be enabled in non-development environments")
            
            return True
            
        except Exception as e:
            logging.error(f"Settings validation failed: {str(e)}")
            return False

def get_settings():
    """Returns thread-safe singleton instance of settings with secure defaults."""
    return Settings.get_instance()

def configure_logging(settings):
    """Configures application-wide logging with structured JSON output and security measures."""
    log_level = logging.DEBUG if settings['debug'] else logging.INFO
    
    # JSON formatter for structured logging
    class SecureJsonFormatter(logging.Formatter):
        def format(self, record):
            # Mask sensitive data
            if hasattr(record, 'password'):
                record.password = '*****'
            if hasattr(record, 'connection_string'):
                record.connection_string = '*****'
            
            log_data = {
                'timestamp': self.formatTime(record),
                'level': record.levelname,
                'message': record.getMessage(),
                'module': record.module,
                'environment': settings['environment']
            }
            
            if record.exc_info:
                log_data['exception'] = self.formatException(record.exc_info)
                
            return json.dumps(log_data)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Console handler with JSON formatting
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(SecureJsonFormatter())
    root_logger.addHandler(console_handler)
    
    # File handler with rotation for non-development environments
    if ENV != 'development':
        log_file = os.path.join(APP_DIR, 'logs', 'app.log')
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10485760,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(SecureJsonFormatter())
        root_logger.addHandler(file_handler)
    
    # Configure error reporting for production
    if ENV == 'production':
        # Initialize error reporting handler
        try:
            from azure.monitor import AzureMonitorHandler
            azure_handler = AzureMonitorHandler(
                connection_string=settings['azure'].get('monitor_connection_string')
            )
            azure_handler.setLevel(logging.ERROR)
            root_logger.addHandler(azure_handler)
        except Exception as e:
            logging.warning(f"Failed to initialize Azure Monitor: {str(e)}")

# Export thread-safe settings singleton instance
settings = get_settings()