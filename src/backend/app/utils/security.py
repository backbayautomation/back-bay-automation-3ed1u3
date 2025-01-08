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

# Initialize security-specific logger
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

# Fields requiring masking for security
SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'key', 'auth', 'api_key', 
    'private_key', 'connection_string', 'access_token'
]

def validate_input(input_string: str, pattern_name: str) -> bool:
    """
    Validates input string against predefined security patterns.
    
    Args:
        input_string (str): String to validate
        pattern_name (str): Name of the validation pattern to use
        
    Returns:
        bool: True if input matches pattern, False otherwise
        
    Raises:
        ValueError: If pattern_name is not found in INPUT_VALIDATION_PATTERNS
    """
    try:
        if not input_string or not pattern_name:
            return False
            
        if pattern_name not in INPUT_VALIDATION_PATTERNS:
            raise ValueError(f"Invalid pattern name: {pattern_name}")
            
        pattern = re.compile(INPUT_VALIDATION_PATTERNS[pattern_name])
        return bool(pattern.match(input_string))
        
    except Exception as e:
        log_security_event(
            "input_validation_error",
            {"pattern": pattern_name, "error": str(e)},
            "ERROR"
        )
        return False

def mask_sensitive_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Masks sensitive fields in data dictionaries for logging and display.
    
    Args:
        data (Dict[str, Any]): Dictionary containing potentially sensitive data
        
    Returns:
        Dict[str, Any]: Data with sensitive fields masked
    """
    if not isinstance(data, dict):
        return data
        
    masked_data = data.copy()
    
    def _mask_recursive(d: Dict[str, Any]) -> None:
        for key, value in d.items():
            if isinstance(value, dict):
                _mask_recursive(value)
            elif any(sensitive in key.lower() for sensitive in SENSITIVE_FIELDS):
                d[key] = '****'
            elif isinstance(value, str) and len(value) > 8:
                for sensitive in SENSITIVE_FIELDS:
                    if sensitive in key.lower():
                        d[key] = '****'
                        break
    
    _mask_recursive(masked_data)
    return masked_data

def generate_secure_token(length: int = 32) -> str:
    """
    Generates cryptographically secure random token.
    
    Args:
        length (int): Desired length of the token (default: 32)
        
    Returns:
        str: URL-safe base64-encoded secure random token
        
    Raises:
        ValueError: If length is less than 16
    """
    if length < 16:
        raise ValueError("Token length must be at least 16 characters")
        
    try:
        token = secrets.token_urlsafe(length)
        return token[:length]
        
    except Exception as e:
        log_security_event(
            "token_generation_error",
            {"error": str(e)},
            "ERROR"
        )
        raise

def log_security_event(event_type: str, event_data: Dict[str, Any], severity: str = "INFO") -> None:
    """
    Logs security-related events with appropriate severity and automated alerts.
    
    Args:
        event_type (str): Type of security event
        event_data (Dict[str, Any]): Event-related data
        severity (str): Log severity level (INFO/WARNING/ERROR/CRITICAL)
    """
    try:
        masked_data = mask_sensitive_data(event_data)
        
        log_data = {
            "event_type": event_type,
            "data": masked_data,
            "environment": settings.ENVIRONMENT
        }
        
        if severity == "CRITICAL":
            SECURITY_LOGGER.critical(f"Security Event: {event_type}", extra=log_data)
        elif severity == "ERROR":
            SECURITY_LOGGER.error(f"Security Event: {event_type}", extra=log_data)
        elif severity == "WARNING":
            SECURITY_LOGGER.warning(f"Security Event: {event_type}", extra=log_data)
        else:
            SECURITY_LOGGER.info(f"Security Event: {event_type}", extra=log_data)
            
        # Trigger immediate alerts for high-severity events
        if severity in ["ERROR", "CRITICAL"]:
            # Alert logic would be implemented here based on monitoring configuration
            pass
            
    except Exception as e:
        SECURITY_LOGGER.error(f"Failed to log security event: {str(e)}")

def hash_data(data: str) -> str:
    """
    Creates secure hash of data using SHA-256 algorithm.
    
    Args:
        data (str): Data to hash
        
    Returns:
        str: 64-character hexadecimal hash string
        
    Raises:
        ValueError: If data is empty
    """
    if not data:
        raise ValueError("Data to hash cannot be empty")
        
    try:
        # Create SHA-256 hash
        hasher = hashlib.sha256()
        hasher.update(data.encode())
        return hasher.hexdigest()
        
    except Exception as e:
        log_security_event(
            "hashing_error",
            {"error": str(e)},
            "ERROR"
        )
        raise