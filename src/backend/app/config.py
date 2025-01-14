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

# Global constants
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
        with self._lock:
            if not self._initialized:
                self._settings = self.load_settings()
                configure_logging(self._settings)
                self._initialized = True
    
    @staticmethod
    def get_instance():
        """Get or create singleton instance with thread safety."""
        global _instance
        if not _instance:
            with _settings_lock:
                if not _instance:
                    _instance = Settings()
        return _instance

    def load_settings(self):
        """Load and validate settings from environment and core configuration."""
        settings = {}
        
        # Load core settings
        settings['database'] = core_settings.get_database_settings()
        settings['azure'] = core_settings.get_azure_settings()
        settings['vector_search'] = core_settings.get_vector_search_settings()
        
        # Environment-specific overrides
        settings['environment'] = {
            'env': ENV,
            'debug': DEBUG,
            'app_dir': APP_DIR,
            'project_root': PROJECT_ROOT
        }
        
        # Document processing settings
        settings['document_processing'] = {
            'status_transitions': {
                DocumentStatus.PENDING.value: [DocumentStatus.PROCESSING.value],
                DocumentStatus.PROCESSING.value: [DocumentStatus.COMPLETED.value, DocumentStatus.FAILED.value],
                DocumentStatus.COMPLETED.value: [],
                DocumentStatus.FAILED.value: [DocumentStatus.PENDING.value]
            },
            'max_retries': 3,
            'retry_delay': 300,  # 5 minutes
            'timeout': 1800  # 30 minutes
        }
        
        # Security settings with secure defaults
        settings['security'] = {
            'encryption_key': os.getenv('ENCRYPTION_KEY'),
            'min_password_length': 12,
            'password_complexity': True,
            'session_timeout': 1800,  # 30 minutes
            'max_login_attempts': 5,
            'lockout_duration': 900,  # 15 minutes
            'secure_headers': {
                'X-Frame-Options': 'DENY',
                'X-Content-Type-Options': 'nosniff',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
            }
        }
        
        # Validate all settings
        if not self.validate_settings(settings):
            raise ValueError("Invalid configuration settings detected")
        
        return settings

    def validate_settings(self, settings):
        """Validate all settings against defined schemas and security requirements."""
        try:
            # Required fields validation
            required_sections = ['database', 'azure', 'vector_search', 'security']
            for section in required_sections:
                if section not in settings:
                    raise ValueError(f"Missing required section: {section}")
            
            # Security validation
            security = settings['security']
            if not security.get('encryption_key'):
                raise ValueError("Encryption key is required")
            if security['min_password_length'] < 12:
                raise ValueError("Minimum password length must be at least 12 characters")
            
            # Database validation
            db = settings['database']
            if not all(k in db for k in ['host', 'port', 'database']):
                raise ValueError("Missing required database configuration")
            
            # Azure validation
            azure = settings['azure']
            if ENV != 'development':
                required_azure = ['key_vault_url', 'tenant_id', 'storage_account']
                if not all(k in azure for k in required_azure):
                    raise ValueError("Missing required Azure configuration")
            
            # Vector search validation
            vector = settings['vector_search']
            required_vector = ['dimension', 'similarity_threshold', 'top_k_results']
            if not all(k in vector for k in required_vector):
                raise ValueError("Missing required vector search configuration")
            
            return True
            
        except Exception as e:
            logging.error(f"Settings validation failed: {str(e)}")
            return False

def get_settings():
    """Returns thread-safe singleton instance of settings with secure defaults."""
    return Settings.get_instance()

def configure_logging(settings):
    """Configures application-wide logging with structured JSON output and security measures."""
    log_level = logging.DEBUG if settings['environment']['debug'] else logging.INFO
    
    # JSON log formatter with sensitive data masking
    class SecureJsonFormatter(logging.Formatter):
        SENSITIVE_FIELDS = ['password', 'token', 'key', 'secret']
        
        def format(self, record):
            log_dict = {
                'timestamp': self.formatTime(record),
                'level': record.levelname,
                'message': record.getMessage(),
                'module': record.module
            }
            
            # Add extra fields while masking sensitive data
            if hasattr(record, 'extra'):
                for key, value in record.extra.items():
                    if any(sensitive in key.lower() for sensitive in self.SENSITIVE_FIELDS):
                        log_dict[key] = '********'
                    else:
                        log_dict[key] = value
            
            # Add exception info if present
            if record.exc_info:
                log_dict['exception'] = self.formatException(record.exc_info)
            
            return json.dumps(log_dict)
    
    # Configure handlers
    handlers = []
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(SecureJsonFormatter())
    handlers.append(console_handler)
    
    # File handler with rotation
    if ENV != 'development':
        file_handler = logging.handlers.RotatingFileHandler(
            filename=os.path.join(APP_DIR, 'logs', 'app.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(SecureJsonFormatter())
        handlers.append(file_handler)
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        handlers=handlers,
        force=True
    )
    
    # Set up error reporting integration if configured
    if ENV != 'development' and settings['azure'].get('application_insights'):
        from opencensus.ext.azure.log_exporter import AzureLogHandler
        azure_handler = AzureLogHandler(
            connection_string=settings['azure']['application_insights']['connection_string']
        )
        logging.getLogger().addHandler(azure_handler)

# Export singleton settings instance and paths
settings = get_settings()