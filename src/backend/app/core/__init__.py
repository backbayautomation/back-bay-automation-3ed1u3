"""
Core module initializer for the AI-powered Product Catalog Search System.
Provides centralized access to essential functionality including configuration,
security, authentication, and event handling.

Version: 1.0.0
"""

# Import configuration management
from .config import (
    settings,
    get_database_settings,
    get_azure_settings,
    get_vector_search_settings
)

# Import security utilities
from .security import (
    verify_password,
    get_password_hash,
    create_access_token,
    verify_token
)

# Import authentication utilities
from .auth import (
    authenticate_user,
    get_current_user,
    get_current_active_user
)

# Import event handlers
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
    
    # Event handler exports
    'register_event_handlers'
]

# Module metadata
__version__ = '1.0.0'
__author__ = 'AI-Powered Product Catalog Search System Team'
__description__ = 'Core functionality for the AI-powered Product Catalog Search System'

# Initialize logging for core module
import logging
logger = logging.getLogger(__name__)
logger.info(
    "Core module initialized",
    extra={
        'version': __version__,
        'exports': __all__
    }
)