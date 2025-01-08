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

# Global constants with secure path resolution
SCRIPTS_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPTS_DIR.parent.parent.resolve()

# Thread-safe logging configuration
_logging_lock = threading.Lock()
logger = logging.getLogger('scripts')

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
            numeric_level = getattr(logging, log_level.upper(), None)
            if not isinstance(numeric_level, int):
                raise ValueError(f'Invalid log level: {log_level}')

            # Configure base logging
            log_config = LogConfig()
            log_config.log_level = numeric_level
            log_config.environment = get_environment()
            
            # Set up script-specific logging format with security context
            log_config.format_string = (
                '%(asctime)s - %(name)s - %(levelname)s - '
                '%(correlation_id)s - %(environment)s - %(message)s'
            )

            # Configure handlers with security context
            configure_logging(
                log_config=log_config,
                module_name='scripts',
                add_security_context=True,
                enable_audit_log=True
            )

            logger.info('Script logging configured successfully')

        except Exception as e:
            # Fallback to basic logging if configuration fails
            logging.basicConfig(level=logging.INFO)
            logging.error(f'Failed to configure script logging: {str(e)}')
            raise

def get_project_root() -> Path:
    """
    Returns the absolute path to the project root directory with validation 
    and security checks.

    Returns:
        Path: Validated absolute path to project root directory

    Raises:
        ValueError: If project root path validation fails
        OSError: If directory permissions are insufficient
    """
    try:
        # Validate PROJECT_ROOT exists
        if not PROJECT_ROOT.exists():
            raise ValueError(f'Project root directory not found: {PROJECT_ROOT}')

        # Check directory permissions
        if not os.access(PROJECT_ROOT, os.R_OK):
            raise OSError(f'Insufficient permissions for project root: {PROJECT_ROOT}')

        # Resolve any symbolic links
        resolved_path = PROJECT_ROOT.resolve(strict=True)

        # Verify path is within expected bounds
        if not str(resolved_path).startswith(str(SCRIPTS_DIR.parent.parent)):
            raise ValueError('Project root path validation failed')

        return resolved_path

    except Exception as e:
        logger.error(f'Failed to validate project root path: {str(e)}')
        raise

# Initialize logging with default configuration
configure_script_logging()

# Export public interface
__all__ = [
    'logger',
    'SCRIPTS_DIR',
    'PROJECT_ROOT',
    'configure_script_logging',
    'get_project_root'
]