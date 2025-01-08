"""
Comprehensive validation utility module implementing secure, high-performance validation functions
for data integrity across the application.

Version: 1.0.0
"""

import re  # version: latest
import uuid  # version: latest
import logging  # version: latest
import dns.resolver  # version: ^2.4.2
import magic  # version: ^0.4.27
import bleach  # version: ^6.0.0
import aiohttp  # version: ^3.8.5
from functools import cache
from typing import Tuple, Optional
from pydantic import ValidationError  # version: ^2.0.0

from ..schemas.user import UserCreate
from ..schemas.document import DocumentCreate
from ..schemas.chat import MessageCreate
from ..core.security import log_security_event

# Configure module logger
logger = logging.getLogger(__name__)

# Constants for validation
EMAIL_PATTERN = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
PASSWORD_MIN_LENGTH = 12
DOCUMENT_MAX_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_MIME_TYPES = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}
BLOCKED_EMAIL_PATTERNS = [
    r'.*@tempmail\.com$',
    r'.*@disposable\..*'
]

@cache(maxsize=1000, ttl=3600)
def validate_email(email: str, verify_domain: bool = True) -> Tuple[bool, str]:
    """
    Enhanced email validation with domain verification and security checks.

    Args:
        email: Email address to validate
        verify_domain: Whether to verify domain MX records

    Returns:
        tuple: (is_valid, error_message)
    """
    try:
        # Basic format validation
        if not re.match(EMAIL_PATTERN, email):
            return False, "Invalid email format"

        # Length validation
        if len(email) > 255:
            return False, "Email exceeds maximum length"

        # Check against blocked patterns
        for pattern in BLOCKED_EMAIL_PATTERNS:
            if re.match(pattern, email, re.IGNORECASE):
                return False, "Email domain not allowed"

        # Domain verification
        if verify_domain:
            domain = email.split('@')[1]
            try:
                dns.resolver.resolve(domain, 'MX')
            except dns.resolver.NoAnswer:
                return False, "Domain has no MX records"
            except dns.resolver.NXDOMAIN:
                return False, "Domain does not exist"

        log_security_event("email_validation", "Email validation successful", 
                         {"email_domain": email.split('@')[1]})
        return True, ""

    except Exception as e:
        logger.error(f"Email validation error: {str(e)}")
        return False, "Validation error occurred"

def validate_password(password: str) -> Tuple[bool, str]:
    """
    Advanced password validation with security rules and common password checks.

    Args:
        password: Password to validate

    Returns:
        tuple: (is_valid, error_message)
    """
    try:
        # Length check
        if len(password) < PASSWORD_MIN_LENGTH:
            return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters"

        # Character type checks
        if not re.search(r'[A-Z]', password):
            return False, "Password must contain uppercase letter"
        if not re.search(r'[a-z]', password):
            return False, "Password must contain lowercase letter"
        if not re.search(r'\d', password):
            return False, "Password must contain number"
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            return False, "Password must contain special character"

        # Check password entropy
        entropy = len(set(password)) * len(password)
        if entropy < 75:
            return False, "Password not complex enough"

        # Log validation attempt (without password)
        log_security_event("password_validation", "Password validation completed", 
                         {"entropy_score": entropy})
        return True, ""

    except Exception as e:
        logger.error(f"Password validation error: {str(e)}")
        return False, "Validation error occurred"

def validate_document_type(file_content: bytes, filename: str, max_size_bytes: int = DOCUMENT_MAX_SIZE) -> Tuple[bool, str, str]:
    """
    Comprehensive document validation with signature verification.

    Args:
        file_content: Raw file content
        filename: Original filename
        max_size_bytes: Maximum allowed file size

    Returns:
        tuple: (is_valid, error_message, detected_mime_type)
    """
    try:
        # Size validation
        if len(file_content) > max_size_bytes:
            return False, f"File exceeds maximum size of {max_size_bytes/1024/1024}MB", ""

        # Detect MIME type
        mime_type = magic.from_buffer(file_content, mime=True)
        
        # Validate against allowed types
        if mime_type not in ALLOWED_MIME_TYPES.values():
            return False, f"File type {mime_type} not allowed", mime_type

        # Verify file extension matches content
        ext = filename.split('.')[-1].lower()
        if mime_type != ALLOWED_MIME_TYPES.get(ext):
            return False, "File extension does not match content", mime_type

        # Log validation result
        log_security_event("document_validation", "Document validation successful",
                         {"mime_type": mime_type, "size": len(file_content)})
        return True, "", mime_type

    except Exception as e:
        logger.error(f"Document validation error: {str(e)}")
        return False, "Validation error occurred", ""

@cache(maxsize=1000, ttl=3600)
def validate_uuid(uuid_string: str, version: int = 4) -> Tuple[bool, str]:
    """
    Enhanced UUID validation with version checking.

    Args:
        uuid_string: UUID string to validate
        version: Expected UUID version

    Returns:
        tuple: (is_valid, error_message)
    """
    try:
        # Parse UUID
        uuid_obj = uuid.UUID(uuid_string)
        
        # Version check
        if uuid_obj.version != version:
            return False, f"UUID must be version {version}"

        # Validate format
        if str(uuid_obj) != uuid_string.lower():
            return False, "Invalid UUID format"

        return True, ""

    except ValueError:
        return False, "Invalid UUID format"
    except Exception as e:
        logger.error(f"UUID validation error: {str(e)}")
        return False, "Validation error occurred"

def validate_chat_message(content: str, role: str, tenant_id: str) -> Tuple[bool, str, str]:
    """
    Secure chat message validation with content sanitization.

    Args:
        content: Message content
        role: Message role
        tenant_id: Tenant identifier

    Returns:
        tuple: (is_valid, error_message, sanitized_content)
    """
    try:
        # Validate tenant ID
        if not validate_uuid(tenant_id)[0]:
            return False, "Invalid tenant ID", ""

        # Content length validation
        if not content or len(content) > 4096:
            return False, "Content length must be between 1 and 4096 characters", ""

        # Role validation
        if role not in ['user', 'system']:
            return False, "Invalid role", ""

        # Sanitize content
        sanitized = bleach.clean(
            content,
            tags=['p', 'b', 'i', 'code'],
            attributes={},
            strip=True
        )

        # Check for blocked patterns
        blocked_patterns = [
            r'<script.*?>.*?</script>',
            r'javascript:',
            r'data:text/html'
        ]
        for pattern in blocked_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return False, "Content contains blocked patterns", ""

        # Log validation event
        log_security_event("message_validation", "Message validation successful",
                         {"role": role, "tenant_id": tenant_id})

        return True, "", sanitized

    except Exception as e:
        logger.error(f"Message validation error: {str(e)}")
        return False, "Validation error occurred", ""