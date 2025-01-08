"""
Core configuration module for the AI-powered Product Catalog Search System.
Provides environment-specific settings, security configurations, and infrastructure settings.

Version: 1.0.0
"""

import os
import json
import logging
import threading
from datetime import datetime
from typing import Dict, Any, Optional

from pydantic import BaseSettings, Field  # version: 2.4.0
from dotenv import load_dotenv  # version: 1.0.0

from ..constants import DocumentStatus

# Global constants
ENV = os.getenv('ENVIRONMENT', 'development')
DEBUG = ENV == 'development'
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Thread-safe singleton implementation
_settings_lock = threading.Lock()
_settings_instance: Optional['Settings'] = None

class JsonLogFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging with enhanced error handling."""
    
    TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S.%f"
    EXCLUDED_KEYS = ['args', 'asctime', 'created', 'exc_info', 'exc_text', 'filename',
                    'levelno', 'module', 'msecs', 'pathname', 'process',
                    'processName', 'relativeCreated', 'stack_info', 'thread', 'threadName']

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as structured JSON with enhanced error handling."""
        log_dict = {
            'timestamp': datetime.fromtimestamp(record.created).strftime(self.TIMESTAMP_FORMAT),
            'level': record.levelname,
            'message': record.getMessage(),
            'logger': record.name
        }

        # Add exception info if present
        if record.exc_info:
            log_dict['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': self.formatException(record.exc_info)
            }

        # Add extra fields from record
        for key, value in record.__dict__.items():
            if key not in self.EXCLUDED_KEYS and not key.startswith('_'):
                log_dict[key] = value

        try:
            return json.dumps(log_dict)
        except Exception as e:
            return json.dumps({
                'timestamp': datetime.now().strftime(self.TIMESTAMP_FORMAT),
                'level': 'ERROR',
                'message': f'Error formatting log message: {str(e)}',
                'logger': 'JsonLogFormatter'
            })

class Settings(BaseSettings):
    """Pydantic settings class for application configuration with environment awareness."""

    PROJECT_NAME: str = "AI-Powered Product Catalog Search"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = Field(default=ENV)
    DEBUG: bool = Field(default=DEBUG)

    DATABASE_CONFIG: Dict[str, Any] = {
        'development': {
            'host': 'localhost',
            'port': 5432,
            'database': 'catalog_search_dev',
            'pool_size': 5,
            'max_overflow': 10
        },
        'staging': {
            'host': 'catalog-search-staging.database.azure.com',
            'port': 5432,
            'database': 'catalog_search_staging',
            'pool_size': 10,
            'max_overflow': 20
        },
        'production': {
            'host': 'catalog-search-prod.database.azure.com',
            'port': 5432,
            'database': 'catalog_search_prod',
            'pool_size': 20,
            'max_overflow': 30
        }
    }

    AZURE_CONFIG: Dict[str, Any] = {
        'key_vault_name': 'catalog-search-kv',
        'tenant_id': Field(..., env='AZURE_TENANT_ID'),
        'client_id': Field(..., env='AZURE_CLIENT_ID'),
        'client_secret': Field(..., env='AZURE_CLIENT_SECRET'),
        'storage_account': Field(..., env='AZURE_STORAGE_ACCOUNT'),
        'container_name': 'documents'
    }

    VECTOR_SEARCH_CONFIG: Dict[str, Any] = {
        'dimension': 1536,
        'similarity_threshold': 0.8,
        'top_k_results': 5,
        'context_window_size': 8192,
        'batch_size': 32,
        'distance_metric': 'cosine'
    }

    SECURITY_CONFIG: Dict[str, Any] = {
        'jwt_secret': Field(..., env='JWT_SECRET'),
        'jwt_algorithm': 'HS256',
        'access_token_expire_minutes': 30,
        'refresh_token_expire_days': 7,
        'password_hash_algorithm': 'bcrypt',
        'min_password_length': 12,
        'require_special_characters': True,
        'max_login_attempts': 5,
        'lockout_duration_minutes': 15
    }

    LOGGING_CONFIG: Dict[str, Any] = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'json': {
                '()': JsonLogFormatter
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'json',
                'level': 'DEBUG' if DEBUG else 'INFO'
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'filename': os.path.join(BASE_DIR, 'logs', 'app.log'),
                'formatter': 'json',
                'maxBytes': 10485760,  # 10MB
                'backupCount': 5,
                'level': 'INFO'
            }
        },
        'root': {
            'handlers': ['console', 'file'] if not DEBUG else ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO'
        }
    }

    def get_database_settings(self) -> Dict[str, Any]:
        """Returns validated database configuration for current environment."""
        db_config = self.DATABASE_CONFIG[self.ENVIRONMENT].copy()
        db_config.update({
            'username': os.getenv('DB_USERNAME'),
            'password': os.getenv('DB_PASSWORD'),
            'ssl_mode': 'require' if self.ENVIRONMENT != 'development' else None
        })
        return db_config

    def get_azure_settings(self) -> Dict[str, Any]:
        """Returns validated Azure service configuration."""
        azure_config = self.AZURE_CONFIG.copy()
        if self.ENVIRONMENT != 'development':
            azure_config.update({
                'use_managed_identity': True,
                'key_vault_url': f"https://{self.AZURE_CONFIG['key_vault_name']}.vault.azure.net/"
            })
        return azure_config

    def get_vector_search_settings(self) -> Dict[str, Any]:
        """Returns optimized vector search configuration."""
        vector_config = self.VECTOR_SEARCH_CONFIG.copy()
        if self.ENVIRONMENT == 'production':
            vector_config.update({
                'cache_enabled': True,
                'cache_ttl_seconds': 3600,
                'max_concurrent_searches': 50
            })
        return vector_config

    def configure_logging(self) -> None:
        """Configures application-wide logging with JSON formatting."""
        os.makedirs(os.path.join(BASE_DIR, 'logs'), exist_ok=True)
        logging.config.dictConfig(self.LOGGING_CONFIG)
        
        # Set up error reporting integration for non-development environments
        if self.ENVIRONMENT != 'development':
            logging.getLogger('azure.monitor').setLevel(logging.INFO)
            logging.getLogger('azure.identity').setLevel(logging.WARNING)

def get_settings() -> Settings:
    """Returns thread-safe singleton instance of Settings class."""
    global _settings_instance
    
    if _settings_instance is None:
        with _settings_lock:
            if _settings_instance is None:
                load_dotenv(os.path.join(BASE_DIR, '.env'))
                _settings_instance = Settings()
                _settings_instance.configure_logging()
    
    return _settings_instance

# Export singleton settings instance
settings = get_settings()