"""
Core module initializer for the AI-powered Product Catalog Search System.
Provides centralized access to essential functionality including configuration,
security, authentication, and event handling.

Version: 1.0.0
"""

# Import configuration settings and utilities
from .config import settings, get_database_settings, get_azure_settings, get_vector_search_settings

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

# Initialize logging
settings.configure_logging()

# Log module initialization
from ..utils.logging import logger
logger.info(
    "Core module initialized successfully",
    extra={
        "module": __name__,
        "environment": settings.ENVIRONMENT,
        "features": {
            "security": True,
            "authentication": True,
            "event_handling": True
        }
    }
)