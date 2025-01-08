"""
Core module initializer for the AI-powered Product Catalog Search System.
Provides centralized access to essential functionality including configuration,
security, authentication, and event handling.

Version: 1.0.0
"""

# Configuration imports
from .config import (
    settings,
    get_database_settings,
    get_azure_settings,
    get_vector_search_settings
)

# Security imports
from .security import (
    verify_password,
    get_password_hash,
    create_access_token,
    verify_token
)

# Authentication imports
from .auth import (
    authenticate_user,
    get_current_user,
    get_current_active_user
)

# Event handling imports
from .events import register_event_handlers

# Export core functionality
__all__ = [
    # Configuration exports
    'settings',
    'get_database_settings',
    'get_azure_settings',
    'get_vector_search_settings',
    
    # Security exports
    'verify_password',
    'get_password_hash',
    'create_access_token',
    'verify_token',
    
    # Authentication exports
    'authenticate_user',
    'get_current_user',
    'get_current_active_user',
    
    # Event handling exports
    'register_event_handlers'
]

# Module metadata
__version__ = "1.0.0"
__author__ = "AI-Powered Product Catalog Search System Team"

# Initialize logging configuration
settings.configure_logging()