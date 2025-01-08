"""
Configuration module for the AI-powered Product Catalog Search System.
Implements a thread-safe singleton pattern for settings management with secure defaults.

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
        
        # Load and validate settings
        with self._lock:
            self._settings = self.load_settings()
            self._initialized = True
            
        # Configure application logging
        configure_logging(self._settings)

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
        
        # Load core settings
        settings['database'] = core_settings.get_database_settings()
        settings['azure'] = core_settings.get_azure_settings()
        settings['vector_search'] = core_settings.get_vector_search_settings()
        
        # Security settings with secure defaults
        settings['security'] = {
            'jwt_secret': os.getenv('JWT_SECRET_KEY'),
            'jwt_algorithm': 'HS256',
            'token_expiry': int(os.getenv('TOKEN_EXPIRY_MINUTES', '30')),
            'encryption_key': Fernet.generate_key() if DEBUG else os.getenv('ENCRYPTION_KEY'),
            'min_password_length': 12,
            'require_mfa': ENV == 'production',
            'session_timeout': 3600,
            'max_login_attempts': 5,
            'password_history': 5
        }
        
        # Document processing settings
        settings['document_processing'] = {
            'status_enum': {
                'pending': DocumentStatus.PENDING,
                'processing': DocumentStatus.PROCESSING,
                'completed': DocumentStatus.COMPLETED,
                'failed': DocumentStatus.FAILED
            },
            'max_file_size_mb': 50,
            'supported_formats': ['pdf', 'docx', 'xlsx'],
            'chunk_size': 1000,
            'chunk_overlap': 200,
            'batch_size': 32
        }
        
        # Monitoring and logging settings
        settings['monitoring'] = {
            'log_level': 'DEBUG' if DEBUG else 'INFO',
            'enable_performance_logging': True,
            'trace_requests': DEBUG,
            'log_retention_days': 30,
            'alert_threshold': {
                'error_rate': 0.05,
                'response_time': 1000,
                'cpu_usage': 80
            }
        }

        # Validate all settings
        if not self.validate_settings(settings):
            raise ValueError("Invalid configuration detected")

        return settings

    def validate_settings(self, settings):
        """Validate all settings against defined schemas and security requirements."""
        try:
            # Validate database settings
            assert all(key in settings['database'] for key in ['host', 'port', 'database'])
            
            # Validate security settings
            assert settings['security']['jwt_secret'], "JWT secret is required"
            assert settings['security']['min_password_length'] >= 12
            
            # Validate vector search settings
            assert settings['vector_search']['dimension'] == 1536
            assert 0 < settings['vector_search']['similarity_threshold'] <= 1
            
            # Validate Azure settings
            if ENV != 'development':
                assert all(key in settings['azure'] for key in ['key_vault_url', 'tenant_id'])
            
            # Validate document processing settings
            assert settings['document_processing']['max_file_size_mb'] > 0
            assert len(settings['document_processing']['supported_formats']) > 0
            
            return True
            
        except AssertionError as e:
            logging.error(f"Settings validation failed: {str(e)}")
            return False

def get_settings():
    """Returns thread-safe singleton instance of settings with secure defaults."""
    return Settings.get_instance()

def configure_logging(settings):
    """Configures application-wide logging with structured JSON output and security measures."""
    log_level = getattr(logging, settings['monitoring']['log_level'])
    
    # Create custom JSON formatter
    class SecureJsonFormatter(logging.Formatter):
        def format(self, record):
            # Mask sensitive data
            message = record.getMessage()
            for sensitive in ['password', 'secret', 'token', 'key']:
                if sensitive in message.lower():
                    message = message.replace(record.getMessage(), f"[MASKED {sensitive.upper()}]")
            record.message = message
            
            return json.dumps({
                'timestamp': self.formatTime(record),
                'level': record.levelname,
                'message': message,
                'logger': record.name,
                'environment': ENV,
                'trace_id': getattr(record, 'trace_id', None)
            })

    # Configure handlers
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(SecureJsonFormatter())
    console_handler.setLevel(log_level)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(console_handler)

    # Add file handler for non-development environments
    if ENV != 'development':
        log_dir = os.path.join(PROJECT_ROOT, 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        file_handler = logging.handlers.RotatingFileHandler(
            os.path.join(log_dir, 'app.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(SecureJsonFormatter())
        file_handler.setLevel(log_level)
        root_logger.addHandler(file_handler)

# Export singleton settings instance and paths
settings = get_settings()