"""
Middleware initialization module for the AI-powered Product Catalog Search System.
Implements thread-safe initialization, proper ordering, and comprehensive error handling
for authentication, authorization, logging, CORS, and multi-tenant request handling.

Version: 1.0.0
"""

import threading  # version: 3.11+
import logging  # version: 3.11+
from typing import Dict, Optional

from .auth_middleware import AuthMiddleware
from .logging_middleware import LoggingMiddleware
from .cors_middleware import get_cors_middleware
from .tenant_middleware import TenantMiddleware

# Module version
__version__ = "1.0.0"

# Export middleware components
__all__ = ["AuthMiddleware", "LoggingMiddleware", "get_cors_middleware", "TenantMiddleware"]

# Define middleware initialization order
MIDDLEWARE_ORDER = ["cors", "auth", "tenant", "logging"]

# Thread-safe initialization lock
_middleware_lock = threading.Lock()

# Initialization state
_initialized = False

# Configure module logger
logger = logging.getLogger(__name__)

def initialize_middleware(config: Dict) -> bool:
    """
    Thread-safe initialization of all middleware components in proper order.
    
    Args:
        config: Configuration dictionary for middleware components
        
    Returns:
        bool: True if initialization successful, False otherwise
    """
    global _initialized
    
    with _middleware_lock:
        try:
            # Check if already initialized
            if _initialized:
                logger.warning("Middleware already initialized")
                return True

            logger.info("Initializing middleware stack")

            # Validate configuration
            if not config:
                raise ValueError("Missing middleware configuration")

            # Initialize CORS middleware first (handles preflight requests)
            cors_config = config.get("cors", {})
            cors_middleware = get_cors_middleware()
            logger.info("CORS middleware initialized")

            # Initialize authentication middleware
            auth_config = config.get("auth", {})
            auth_middleware = AuthMiddleware(app=None)
            auth_middleware.initialize(auth_config)
            logger.info("Authentication middleware initialized")

            # Initialize tenant middleware
            tenant_config = config.get("tenant", {})
            tenant_middleware = TenantMiddleware(app=None)
            tenant_middleware.initialize(tenant_config)
            logger.info("Tenant middleware initialized")

            # Initialize logging middleware last (to capture all request details)
            logging_config = config.get("logging", {})
            logging_middleware = LoggingMiddleware(app=None)
            logging_middleware.initialize(logging_config)
            logger.info("Logging middleware initialized")

            # Set initialization flag
            _initialized = True
            
            logger.info("Middleware stack initialization completed successfully")
            return True

        except Exception as e:
            logger.error(f"Middleware initialization failed: {str(e)}", exc_info=True)
            _initialized = False
            return False

def get_middleware_stack(app) -> list:
    """
    Get ordered list of initialized middleware components.
    
    Args:
        app: FastAPI application instance
        
    Returns:
        list: Ordered list of middleware instances
        
    Raises:
        RuntimeError: If middleware not initialized
    """
    if not _initialized:
        raise RuntimeError("Middleware not initialized. Call initialize_middleware first.")

    # Return middleware in correct order
    middleware_stack = []
    
    # CORS middleware first (handles preflight)
    middleware_stack.append(get_cors_middleware())
    
    # Auth middleware for security
    middleware_stack.append(AuthMiddleware(app))
    
    # Tenant middleware for isolation
    middleware_stack.append(TenantMiddleware(app))
    
    # Logging middleware last to capture everything
    middleware_stack.append(LoggingMiddleware(app))

    return middleware_stack

def check_initialization_status() -> Dict:
    """
    Check initialization status of middleware components.
    
    Returns:
        Dict: Status of each middleware component
    """
    return {
        "initialized": _initialized,
        "components": {
            "cors": get_cors_middleware() is not None,
            "auth": AuthMiddleware is not None,
            "tenant": TenantMiddleware is not None,
            "logging": LoggingMiddleware is not None
        }
    }

def reset_middleware() -> None:
    """
    Reset middleware initialization state.
    For testing and recovery purposes.
    """
    global _initialized
    
    with _middleware_lock:
        _initialized = False
        logger.warning("Middleware initialization state reset")