"""
Middleware initialization module for the AI-powered Product Catalog Search System.
Implements thread-safe initialization, proper ordering, and comprehensive error handling
for the middleware stack.

Version: 1.0.0
"""

import threading
import logging
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
        config: Configuration dictionary containing middleware settings
        
    Returns:
        bool: True if initialization successful, False otherwise
        
    Raises:
        RuntimeError: If initialization fails
    """
    global _initialized
    
    @threading.synchronized(_middleware_lock)
    def _initialize() -> bool:
        global _initialized
        
        if _initialized:
            logger.warning("Middleware already initialized")
            return True

        try:
            logger.info(
                "Initializing middleware stack",
                extra={"order": MIDDLEWARE_ORDER}
            )

            # Initialize CORS middleware first
            cors_config = config.get("cors", {})
            cors_middleware = get_cors_middleware()
            
            # Initialize authentication middleware
            auth_config = config.get("auth", {})
            auth_middleware = AuthMiddleware(
                app=None,  # Will be set by FastAPI
                tenant_config=auth_config.get("tenant_config", {})
            )

            # Initialize tenant middleware
            tenant_middleware = TenantMiddleware(app=None)  # Will be set by FastAPI
            
            # Initialize logging middleware last
            logging_config = config.get("logging", {})
            logging_middleware = LoggingMiddleware(
                app=None,  # Will be set by FastAPI
                config=logging_config
            )

            # Validate middleware initialization
            if not all([
                cors_middleware,
                auth_middleware,
                tenant_middleware,
                logging_middleware
            ]):
                raise RuntimeError("One or more middleware components failed to initialize")

            _initialized = True
            
            logger.info(
                "Middleware stack initialized successfully",
                extra={
                    "components": MIDDLEWARE_ORDER,
                    "status": "initialized"
                }
            )
            
            return True

        except Exception as e:
            logger.error(
                "Middleware initialization failed",
                extra={
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
            raise RuntimeError(f"Failed to initialize middleware: {str(e)}")

    return _initialize()

def get_middleware_status() -> Dict:
    """
    Get current status of middleware initialization.
    
    Returns:
        Dict containing middleware initialization status
    """
    return {
        "initialized": _initialized,
        "components": MIDDLEWARE_ORDER,
        "status": "ready" if _initialized else "not_initialized"
    }

def reset_middleware() -> None:
    """
    Reset middleware initialization state for testing purposes.
    Should only be used in development/testing environments.
    """
    global _initialized
    
    with _middleware_lock:
        _initialized = False
        logger.warning("Middleware initialization state reset")