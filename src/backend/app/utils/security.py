"""
Security utility module providing enhanced security functions for request validation,
data protection, and security monitoring in the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

import re  # version: latest
import logging  # version: latest
import secrets  # version: latest
import hashlib  # version: latest
from typing import Dict, Any

from ..core.security import verify_token
from ..config import settings

# Initialize security logger with appropriate configuration
SECURITY_LOGGER = logging.getLogger('security')

# Comprehensive input validation patterns
INPUT_VALIDATION_PATTERNS = {
    'email': r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$',
    'username': r'^[a-zA-Z0-9_-]{3,32}$',
    'password': r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$',
    'client_id': r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    'document_id': r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    'phone': r'^\+?1?\d{9,15}$',
    'url': r'^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$'
}

# Fields that should be masked in logs and outputs
SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'key', 'auth', 'api_key', 
    'access_token', 'refresh_token', 'private_key', 'credential'
]

def validate_input(input_string: str, pattern_name: str) -> bool:
    """
    Validates input string against predefined security patterns with comprehensive pattern matching.
    
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
        is_valid = bool(compiled_pattern.match(input_string))
        
        if not is_valid:
            SECURITY_LOGGER.warning(
                "Input validation failed",
                extra={
                    "pattern_name": pattern_name,
                    "input_length": len(input_string)
                }
            )
            
        return is_valid
        
    except Exception as e:
        SECURITY_LOGGER.error(
            "Input validation error",
            extra={
                "error": str(e),
                "pattern_name": pattern_name
            }
        )
        return False

def mask_sensitive_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Masks sensitive fields in data dictionaries for logging and display with configurable field detection.
    
    Args:
        data: Dictionary containing potentially sensitive data
        
    Returns:
        dict: Data with sensitive fields masked
    """
    if not isinstance(data, dict):
        return data
        
    masked_data = data.copy()
    
    def _recursive_mask(obj: Any) -> Any:
        if isinstance(obj, dict):
            return {
                k: '****' if any(sensitive in k.lower() for sensitive in SENSITIVE_FIELDS)
                else _recursive_mask(v)
                for k, v in obj.items()
            }
        elif isinstance(obj, list):
            return [_recursive_mask(item) for item in obj]
        return obj
    
    try:
        return _recursive_mask(masked_data)
    except Exception as e:
        SECURITY_LOGGER.error(
            "Data masking error",
            extra={"error": str(e)}
        )
        return masked_data

def generate_secure_token(length: int = 32) -> str:
    """
    Generates cryptographically secure random token using secrets module.
    
    Args:
        length: Desired length of the token (default: 32)
        
    Returns:
        str: URL-safe base64-encoded secure random token string
    """
    try:
        if length < 16:
            raise ValueError("Token length must be at least 16 characters")
            
        # Generate secure random token
        token = secrets.token_urlsafe(length)
        
        # Ensure exact length by truncating or padding
        if len(token) < length:
            token += secrets.token_urlsafe(length - len(token))
        return token[:length]
        
    except Exception as e:
        SECURITY_LOGGER.error(
            "Token generation error",
            extra={
                "error": str(e),
                "requested_length": length
            }
        )
        raise

def log_security_event(event_type: str, event_data: Dict[str, Any], severity: str = "INFO") -> None:
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
        
        # Prepare log message
        log_message = {
            "event_type": event_type,
            "timestamp": logging.Formatter().formatTime(logging.LogRecord("", 0, "", 0, None, None, None)),
            "data": masked_data
        }
        
        # Log with appropriate severity
        if severity == "CRITICAL":
            SECURITY_LOGGER.critical(f"Security event: {event_type}", extra=log_message)
        elif severity == "ERROR":
            SECURITY_LOGGER.error(f"Security event: {event_type}", extra=log_message)
        elif severity == "WARNING":
            SECURITY_LOGGER.warning(f"Security event: {event_type}", extra=log_message)
        else:
            SECURITY_LOGGER.info(f"Security event: {event_type}", extra=log_message)
            
    except Exception as e:
        SECURITY_LOGGER.error(
            "Security event logging error",
            extra={
                "error": str(e),
                "event_type": event_type
            }
        )

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
            
        # Create SHA-256 hash
        hasher = hashlib.sha256()
        hasher.update(data.encode())
        return hasher.hexdigest()
        
    except Exception as e:
        SECURITY_LOGGER.error(
            "Data hashing error",
            extra={
                "error": str(e),
                "data_length": len(data) if data else 0
            }
        )
        raise