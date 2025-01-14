"""
Middleware initialization module for the AI-powered Product Catalog Search System.
Implements thread-safe initialization and proper ordering of middleware components
with comprehensive error handling and monitoring.

Version: 1.0.0
"""

import threading
import logging
from typing import Dict, Any, List

# Import middleware components
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

def initialize_middleware(config: Dict[str, Any]) -> bool:
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
                logger.warning("Middleware components already initialized")
                return True
                
            logger.info("Initializing middleware components")
            
            # Validate configuration
            if not _validate_config(config):
                raise ValueError("Invalid middleware configuration")
            
            initialized_components: List[str] = []
            
            # Initialize components in defined order
            for component in MIDDLEWARE_ORDER:
                try:
                    if component == "cors":
                        # Initialize CORS middleware first
                        cors_config = config.get("cors", {})
                        get_cors_middleware()
                        initialized_components.append("cors")
                        logger.info("CORS middleware initialized")
                        
                    elif component == "auth":
                        # Initialize authentication middleware
                        auth_config = config.get("auth", {})
                        AuthMiddleware.initialize(auth_config)
                        initialized_components.append("auth")
                        logger.info("Authentication middleware initialized")
                        
                    elif component == "tenant":
                        # Initialize tenant middleware
                        tenant_config = config.get("tenant", {})
                        TenantMiddleware.initialize(tenant_config)
                        initialized_components.append("tenant")
                        logger.info("Tenant middleware initialized")
                        
                    elif component == "logging":
                        # Initialize logging middleware last
                        logging_config = config.get("logging", {})
                        LoggingMiddleware.initialize(logging_config)
                        initialized_components.append("logging")
                        logger.info("Logging middleware initialized")
                        
                except Exception as e:
                    logger.error(
                        f"Failed to initialize {component} middleware: {str(e)}",
                        exc_info=True
                    )
                    # Attempt cleanup of initialized components
                    _cleanup_initialization(initialized_components)
                    raise
            
            _initialized = True
            logger.info("All middleware components initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Middleware initialization failed: {str(e)}", exc_info=True)
            return False

def _validate_config(config: Dict[str, Any]) -> bool:
    """
    Validate middleware configuration completeness and correctness.
    
    Args:
        config: Configuration dictionary to validate
        
    Returns:
        bool: True if configuration is valid
    """
    required_sections = ["cors", "auth", "tenant", "logging"]
    
    try:
        # Check for required configuration sections
        if not all(section in config for section in required_sections):
            missing = [s for s in required_sections if s not in config]
            logger.error(f"Missing required configuration sections: {missing}")
            return False
            
        # Validate CORS configuration
        cors_config = config.get("cors", {})
        if not isinstance(cors_config.get("cors_origins"), list):
            logger.error("CORS origins must be a list")
            return False
            
        # Validate auth configuration
        auth_config = config.get("auth", {})
        if not auth_config.get("jwt_secret"):
            logger.error("JWT secret is required in auth configuration")
            return False
            
        # Validate tenant configuration
        tenant_config = config.get("tenant", {})
        if not tenant_config.get("isolation_level"):
            logger.error("Tenant isolation level is required")
            return False
            
        # Validate logging configuration
        logging_config = config.get("logging", {})
        if not logging_config.get("log_level"):
            logger.error("Log level is required in logging configuration")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Configuration validation failed: {str(e)}", exc_info=True)
        return False

def _cleanup_initialization(initialized_components: List[str]) -> None:
    """
    Clean up partially initialized middleware components.
    
    Args:
        initialized_components: List of successfully initialized components
    """
    logger.info(f"Cleaning up initialized components: {initialized_components}")
    
    try:
        # Cleanup in reverse order
        for component in reversed(initialized_components):
            try:
                if component == "logging":
                    LoggingMiddleware.cleanup()
                elif component == "tenant":
                    TenantMiddleware.cleanup()
                elif component == "auth":
                    AuthMiddleware.cleanup()
                elif component == "cors":
                    # CORS middleware doesn't require cleanup
                    pass
                    
                logger.info(f"Cleaned up {component} middleware")
                
            except Exception as e:
                logger.error(
                    f"Error cleaning up {component} middleware: {str(e)}",
                    exc_info=True
                )
                
    except Exception as e:
        logger.error(f"Cleanup failed: {str(e)}", exc_info=True)