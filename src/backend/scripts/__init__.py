"""
Package initialization file for the backend scripts module.
Provides comprehensive utilities for database management, API documentation generation,
and development environment setup with secure logging and audit capabilities.

Version: 1.0.0
"""

import logging  # version: latest
from pathlib import Path  # version: latest
import threading  # version: latest

from ..app.core.config import settings, get_database_settings, get_environment
from ..app.logging_config import configure_logging, LogConfig

# Initialize module-level logger with security context
logger = logging.getLogger('scripts')

# Validate and resolve script paths
SCRIPTS_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPTS_DIR.parent.parent.resolve()

# Thread-safe logging configuration lock
_logging_lock = threading.Lock()

def configure_script_logging(log_level: str = 'INFO') -> None:
    """
    Configures thread-safe logging for all script modules with consistent formatting,
    security context, and proper error handling.

    Args:
        log_level (str): Desired logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Raises:
        ValueError: If invalid log level is provided
        OSError: If unable to create log directory or files
    """
    with _logging_lock:
        try:
            # Validate log level
            numeric_level = getattr(logging, log_level.upper())
            if not isinstance(numeric_level, int):
                raise ValueError(f'Invalid log level: {log_level}')

            # Get environment settings
            env = get_environment()
            
            # Configure base logging
            log_config = LogConfig()
            log_config.log_format = (
                '%(asctime)s - %(name)s - %(levelname)s - '
                '%(environment)s - %(correlation_id)s - %(message)s'
            )
            
            # Set up logging directory
            log_dir = PROJECT_ROOT / 'logs' / 'scripts'
            log_dir.mkdir(parents=True, exist_ok=True)
            
            # Configure handlers with security context
            handlers = []
            
            # Console handler
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(log_config.get_formatter())
            console_handler.addFilter(log_config.security_filter)
            handlers.append(console_handler)
            
            # File handler for audit logging
            if env != 'development':
                file_handler = logging.handlers.RotatingFileHandler(
                    filename=log_dir / 'scripts.log',
                    maxBytes=10*1024*1024,  # 10MB
                    backupCount=5,
                    encoding='utf-8'
                )
                file_handler.setFormatter(log_config.get_formatter())
                file_handler.addFilter(log_config.security_filter)
                handlers.append(file_handler)
            
            # Configure root logger
            root_logger = logging.getLogger()
            root_logger.setLevel(numeric_level)
            
            # Remove existing handlers and add new ones
            for handler in root_logger.handlers[:]:
                root_logger.removeHandler(handler)
            for handler in handlers:
                root_logger.addHandler(handler)
            
            # Set script-specific logger level
            logger.setLevel(numeric_level)
            
            logger.info(
                "Script logging configured successfully",
                extra={
                    'environment': env,
                    'log_level': log_level,
                    'handlers': [h.__class__.__name__ for h in handlers]
                }
            )
            
        except Exception as e:
            # Ensure basic logging is available even if configuration fails
            logging.basicConfig(level=logging.INFO)
            logger.error(f"Failed to configure script logging: {str(e)}")
            raise

def get_project_root() -> Path:
    """
    Returns the absolute path to the project root directory with validation
    and security checks.

    Returns:
        Path: Validated absolute path to project root directory

    Raises:
        OSError: If project root directory is invalid or inaccessible
        SecurityError: If path resolution reveals potential security risks
    """
    try:
        # Validate PROJECT_ROOT exists
        if not PROJECT_ROOT.exists():
            raise OSError(f"Project root directory does not exist: {PROJECT_ROOT}")
        
        # Check directory permissions
        if not os.access(PROJECT_ROOT, os.R_OK):
            raise OSError(f"Insufficient permissions for project root: {PROJECT_ROOT}")
        
        # Resolve any symbolic links
        real_path = PROJECT_ROOT.resolve(strict=True)
        
        # Verify path is within expected bounds
        if not str(real_path).startswith(str(PROJECT_ROOT.parent)):
            raise SecurityError("Project root path resolution outside expected bounds")
        
        logger.debug(
            "Project root path validated",
            extra={
                'path': str(real_path),
                'is_absolute': real_path.is_absolute(),
                'is_dir': real_path.is_dir()
            }
        )
        
        return real_path
        
    except Exception as e:
        logger.error(f"Failed to validate project root path: {str(e)}")
        raise

# Configure default logging
configure_script_logging()

# Export public interface
__all__ = [
    'logger',
    'SCRIPTS_DIR',
    'PROJECT_ROOT',
    'configure_script_logging',
    'get_project_root'
]