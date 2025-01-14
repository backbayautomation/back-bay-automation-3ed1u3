"""
Package initialization file for the backend scripts module.
Provides comprehensive utilities for database management, API documentation generation,
and development environment setup with secure logging and audit capabilities.

Version: 1.0.0
"""

import logging
from pathlib import Path
import threading

from ..app.core.config import settings
from ..app.logging_config import configure_logging, LogConfig

# Configure thread-safe logging
_logging_lock = threading.Lock()

# Initialize module-level logger
logger = logging.getLogger('scripts')

# Resolve and validate script paths
SCRIPTS_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPTS_DIR.parent.parent.resolve()

def configure_script_logging(log_level: str = 'INFO') -> None:
    """
    Configures thread-safe logging for all script modules with consistent formatting,
    security context, and proper error handling.

    Args:
        log_level (str): Desired logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Raises:
        ValueError: If invalid log level is provided
        OSError: If unable to create/access log files
    """
    with _logging_lock:
        try:
            # Validate log level
            numeric_level = getattr(logging, log_level.upper(), None)
            if not isinstance(numeric_level, int):
                raise ValueError(f'Invalid log level: {log_level}')

            # Get environment settings
            env = settings.get_environment()
            
            # Configure base logging
            configure_logging()
            
            # Set script-specific logging format with security context
            log_config = LogConfig()
            log_config.add_security_context({
                'component': 'scripts',
                'environment': env
            })

            # Configure console handler with security filters
            console_handler = logging.StreamHandler()
            console_handler.setLevel(numeric_level)
            console_handler.setFormatter(log_config.get_json_formatter())
            logger.addHandler(console_handler)

            # Configure file handler for audit logging in non-dev environments
            if env != 'development':
                log_dir = SCRIPTS_DIR / 'logs'
                log_dir.mkdir(exist_ok=True)
                
                file_handler = logging.handlers.RotatingFileHandler(
                    filename=log_dir / 'scripts.log',
                    maxBytes=10*1024*1024,  # 10MB
                    backupCount=5,
                    encoding='utf-8'
                )
                file_handler.setLevel(numeric_level)
                file_handler.setFormatter(log_config.get_json_formatter())
                logger.addHandler(file_handler)

            logger.setLevel(numeric_level)
            logger.info(f'Script logging configured with level {log_level}')

        except Exception as e:
            # Ensure basic logging is available even if configuration fails
            logging.basicConfig(level='INFO')
            logger.error(f'Failed to configure script logging: {str(e)}')
            raise

def get_project_root() -> Path:
    """
    Returns the absolute path to the project root directory with validation
    and security checks.

    Returns:
        Path: Validated absolute path to project root directory

    Raises:
        FileNotFoundError: If project root directory does not exist
        PermissionError: If insufficient permissions to access directory
    """
    try:
        # Validate PROJECT_ROOT exists
        if not PROJECT_ROOT.exists():
            raise FileNotFoundError(f'Project root directory not found: {PROJECT_ROOT}')

        # Check directory permissions
        if not os.access(PROJECT_ROOT, os.R_OK):
            raise PermissionError(f'Insufficient permissions to access project root: {PROJECT_ROOT}')

        # Resolve any symbolic links
        real_path = PROJECT_ROOT.resolve(strict=True)

        # Verify path is within expected bounds
        if not str(real_path).startswith(str(SCRIPTS_DIR.parent.parent)):
            raise ValueError('Project root path is outside expected directory structure')

        return real_path

    except Exception as e:
        logger.error(f'Error accessing project root directory: {str(e)}')
        raise

# Configure initial logging
configure_script_logging()

# Export public interface
__all__ = [
    'logger',
    'SCRIPTS_DIR',
    'PROJECT_ROOT',
    'configure_script_logging',
    'get_project_root'
]