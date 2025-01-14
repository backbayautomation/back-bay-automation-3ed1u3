"""
Custom exception classes for the AI-powered Product Catalog Search System.
Implements a comprehensive hierarchy of application-specific exceptions with
enhanced security monitoring, detailed error context support, and integration
with system monitoring tools.

External Dependencies:
    fastapi: ^0.103.0
"""

from datetime import datetime, timezone
from typing import Optional, Dict, List, Any
import uuid
import logging
from fastapi import HTTPException, status

# Configure logger for exception monitoring
logger = logging.getLogger(__name__)

class BaseAppException(Exception):
    """
    Base exception class for all application-specific exceptions with enhanced
    error context support and monitoring integration.
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None,
        error_id: Optional[str] = None,
        monitoring_context: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Initialize base exception with enhanced error context and monitoring support.

        Args:
            message: Human-readable error description
            status_code: HTTP status code for the error
            details: Additional error context details
            error_id: Unique identifier for the error instance
            monitoring_context: Additional context for monitoring systems
        """
        super().__init__(message)
        
        # Generate unique error ID if not provided
        self.error_id = error_id or str(uuid.uuid4())
        
        # Sanitize and set basic error information
        self.message = self._sanitize_content(message)
        self.status_code = status_code
        self.details = self._sanitize_content(details or {})
        self.timestamp = datetime.now(timezone.utc)
        
        # Initialize monitoring context
        self.monitoring_context = {
            'error_id': self.error_id,
            'timestamp': self.timestamp.isoformat(),
            'status_code': self.status_code,
            **self._sanitize_content(monitoring_context or {})
        }
        
        # Log error details to monitoring system
        self.log_error()

    def _sanitize_content(self, content: Any) -> Any:
        """
        Sanitize content to remove sensitive information and invalid characters.
        
        Args:
            content: Content to sanitize
            
        Returns:
            Sanitized content
        """
        if isinstance(content, dict):
            return {
                self._sanitize_content(k): self._sanitize_content(v)
                for k, v in content.items()
            }
        elif isinstance(content, list):
            return [self._sanitize_content(item) for item in content]
        elif isinstance(content, str):
            # Remove potential sensitive patterns (e.g., tokens, passwords)
            return self._remove_sensitive_data(content)
        return content

    def _remove_sensitive_data(self, text: str) -> str:
        """
        Remove potentially sensitive information from string content.
        
        Args:
            text: Text to process
            
        Returns:
            Sanitized text
        """
        # Add patterns for sensitive data removal
        sensitive_patterns = [
            (r'Bearer\s+[a-zA-Z0-9-._~+/]+=*', '[REDACTED_TOKEN]'),
            (r'password["\']?\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'password=[REDACTED]'),
            (r'api[_-]key["\']?\s*[:=]\s*["\']?[^"\'\s]+["\']?', 'api_key=[REDACTED]')
        ]
        
        result = text
        for pattern, replacement in sensitive_patterns:
            result = result.replace(pattern, replacement)
        return result

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert exception to dictionary format for API responses.
        
        Returns:
            Dictionary representation of the exception
        """
        return {
            'error_id': self.error_id,
            'message': self.message,
            'status_code': self.status_code,
            'timestamp': self.timestamp.isoformat(),
            'details': self.details
        }

    def log_error(self) -> None:
        """Log error details to monitoring system."""
        log_data = {
            'error_type': self.__class__.__name__,
            **self.monitoring_context
        }
        logger.error(
            f"Application error occurred: {self.message}",
            extra=log_data
        )

class AuthenticationError(BaseAppException):
    """
    Exception raised for authentication-related errors with security monitoring integration.
    """
    
    def __init__(
        self,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        auth_type: Optional[str] = None,
        security_context: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Initialize authentication error with security context.
        
        Args:
            message: Error description
            details: Additional error details
            auth_type: Type of authentication that failed
            security_context: Security-related context information
        """
        self.auth_type = auth_type or 'unknown'
        self.security_context = self._sanitize_content(security_context or {})
        self.failed_attempts: List[Dict[str, Any]] = []
        
        # Enhance monitoring context with security information
        monitoring_context = {
            'auth_type': self.auth_type,
            'security_context': self.security_context,
            'failed_attempts': self.failed_attempts
        }
        
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
            monitoring_context=monitoring_context
        )
        
        # Track failed authentication attempt
        self._track_failed_attempt()

    def _track_failed_attempt(self) -> None:
        """Track failed authentication attempt and check security thresholds."""
        attempt = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'auth_type': self.auth_type,
            'context': self.security_context
        }
        self.failed_attempts.append(attempt)
        
        # Check for potential security threats
        self._check_security_thresholds()

    def _check_security_thresholds(self) -> None:
        """Check security thresholds and trigger alerts if necessary."""
        # Example threshold: 5 failed attempts
        if len(self.failed_attempts) >= 5:
            self._trigger_security_alert()

    def _trigger_security_alert(self) -> None:
        """Trigger security alert for suspicious authentication activity."""
        alert_data = {
            'error_id': self.error_id,
            'auth_type': self.auth_type,
            'failed_attempts': len(self.failed_attempts),
            'security_context': self.security_context
        }
        logger.warning(
            "Security alert: Multiple authentication failures detected",
            extra=alert_data
        )

    def get_security_context(self) -> Dict[str, Any]:
        """
        Get security context information.
        
        Returns:
            Dictionary containing security context
        """
        return {
            'auth_type': self.auth_type,
            'failed_attempts': self.failed_attempts,
            'security_context': self.security_context
        }