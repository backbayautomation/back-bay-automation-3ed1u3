"""
Security utility module providing enhanced security functions for request validation,
data protection, and security monitoring in the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

import re  # version: latest
import logging  # version: latest
import secrets  # version: latest
import hashlib  # version: latest

from ..core.security import verify_token
from ..config import settings

# Initialize security logger
SECURITY_LOGGER = logging.getLogger('security')

# Regular expression patterns for input validation
INPUT_VALIDATION_PATTERNS = {
    'email': r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$',
    'username': r'^[a-zA-Z0-9_-]{3,32}$',
    'password': r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$'
}

# Fields to be masked in logs and outputs
SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'auth']

def validate_input(input_string: str, pattern_name: str) -> bool:
    """
    Validates input string against predefined security patterns.

    Args:
        input_string: String to validate
        pattern_name: Name of the validation pattern to use

    Returns:
        bool: True if input matches pattern, False otherwise
    """
    try:
        if not input_string or not pattern_name:
            return False

        pattern = INPUT_VALIDATION_PATTERNS.get(pattern_name)
        if not pattern:
            SECURITY_LOGGER.error(f"Invalid pattern name: {pattern_name}")
            return False

        compiled_pattern = re.compile(pattern)
        return bool(compiled_pattern.match(input_string))

    except Exception as e:
        SECURITY_LOGGER.error(f"Input validation error: {str(e)}")
        return False

def mask_sensitive_data(data: dict) -> dict:
    """
    Masks sensitive fields in data dictionaries for logging and display.

    Args:
        data: Dictionary containing potentially sensitive data

    Returns:
        dict: Data with sensitive fields masked
    """
    try:
        if not isinstance(data, dict):
            return data

        masked_data = data.copy()
        for key, value in masked_data.items():
            if isinstance(value, dict):
                masked_data[key] = mask_sensitive_data(value)
            elif any(sensitive in key.lower() for sensitive in SENSITIVE_FIELDS):
                masked_data[key] = '****'
            elif isinstance(value, str) and len(value) > 32:
                # Mask potentially sensitive long strings
                masked_data[key] = f"{value[:8]}...{value[-4:]}"

        return masked_data

    except Exception as e:
        SECURITY_LOGGER.error(f"Data masking error: {str(e)}")
        return {'error': 'Data masking failed'}

def generate_secure_token(length: int = 32) -> str:
    """
    Generates cryptographically secure random token.

    Args:
        length: Desired length of token (default: 32)

    Returns:
        str: URL-safe base64-encoded secure random token
    """
    try:
        if not isinstance(length, int) or length < 16:
            raise ValueError("Token length must be at least 16 characters")

        # Generate secure random token
        token = secrets.token_urlsafe(length)
        
        # Ensure exact length by trimming or padding
        if len(token) > length:
            token = token[:length]
        elif len(token) < length:
            token = token.ljust(length, 'A')

        return token

    except Exception as e:
        SECURITY_LOGGER.error(f"Token generation error: {str(e)}")
        raise

def log_security_event(event_type: str, event_data: dict, severity: str = 'INFO') -> None:
    """
    Logs security-related events with appropriate severity and automated alerts.

    Args:
        event_type: Type of security event
        event_data: Dictionary containing event details
        severity: Log severity level (INFO/WARNING/ERROR/CRITICAL)
    """
    try:
        # Mask sensitive data before logging
        masked_data = mask_sensitive_data(event_data)
        
        # Format log message
        log_message = f"Security Event [{event_type}]: {masked_data}"
        
        # Log with appropriate severity
        if severity == 'CRITICAL':
            SECURITY_LOGGER.critical(log_message)
            # Trigger immediate alerts for critical events
            _trigger_security_alert(event_type, masked_data, 'CRITICAL')
        elif severity == 'ERROR':
            SECURITY_LOGGER.error(log_message)
            _trigger_security_alert(event_type, masked_data, 'ERROR')
        elif severity == 'WARNING':
            SECURITY_LOGGER.warning(log_message)
        else:
            SECURITY_LOGGER.info(log_message)

    except Exception as e:
        SECURITY_LOGGER.error(f"Security event logging error: {str(e)}")

def hash_data(data: str) -> str:
    """
    Creates secure hash of data using SHA-256 algorithm.

    Args:
        data: String data to hash

    Returns:
        str: 64-character hexadecimal hash string
    """
    try:
        if not data:
            raise ValueError("Data to hash cannot be empty")

        # Convert string to bytes and create hash
        data_bytes = data.encode('utf-8')
        hash_object = hashlib.sha256(data_bytes)
        return hash_object.hexdigest()

    except Exception as e:
        SECURITY_LOGGER.error(f"Data hashing error: {str(e)}")
        raise

def _trigger_security_alert(event_type: str, event_data: dict, severity: str) -> None:
    """
    Internal function to trigger security alerts for high-severity events.

    Args:
        event_type: Type of security event
        event_data: Dictionary containing event details
        severity: Alert severity level
    """
    try:
        alert_data = {
            'event_type': event_type,
            'severity': severity,
            'timestamp': logging.Formatter().formatTime(logging.LogRecord('', 0, '', 0, None, None, None)),
            'data': event_data
        }
        
        # Log alert to security monitoring system
        SECURITY_LOGGER.critical(f"Security Alert: {alert_data}")
        
        # Additional alert actions could be implemented here
        # e.g., sending to Azure Monitor, triggering incident response, etc.

    except Exception as e:
        SECURITY_LOGGER.error(f"Security alert trigger error: {str(e)}")