"""
Custom exception classes for the AI-powered Product Catalog Search System.
Implements a comprehensive hierarchy of application-specific exceptions with enhanced
security monitoring, detailed error context support, and integration with system monitoring tools.

External Dependencies:
    fastapi: ^0.103.0
"""

from datetime import datetime, timezone
from typing import Optional, Dict, List
import uuid
import logging
from fastapi import HTTPException, status

# Configure logger for exceptions
logger = logging.getLogger(__name__)

class BaseAppException(Exception):
    """
    Base exception class for all application-specific exceptions with enhanced
    error context support and monitoring integration.
    
    Attributes:
        message (str): Human-readable error message
        status_code (int): HTTP status code for the error
        details (dict): Additional error context and details
        error_id (str): Unique identifier for the error instance
        timestamp (datetime): UTC timestamp when the error occurred
        monitoring_context (dict): System state and monitoring information
    """
    
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict] = None,
        error_id: Optional[str] = None,
        monitoring_context: Optional[Dict] = None
    ) -> None:
        """
        Initialize base exception with enhanced error context and monitoring support.
        
        Args:
            message: Human-readable error description
            status_code: HTTP status code for the error
            details: Additional error context and details
            error_id: Unique identifier for the error instance
            monitoring_context: System state and monitoring information
        """
        super().__init__(message)
        
        # Generate unique error ID if not provided
        self.error_id = error_id or str(uuid.uuid4())
        
        # Sanitize and set message
        self.message = self._sanitize_content(message)
        self.status_code = status_code
        
        # Initialize details with sanitized content
        self.details = self._sanitize_content(details or {})
        
        # Set timestamp in UTC
        self.timestamp = datetime.now(timezone.utc)
        
        # Initialize monitoring context
        self.monitoring_context = self._initialize_monitoring_context(monitoring_context)
        
        # Log error details
        self.log_error()

    def _sanitize_content(self, content: any) -> any:
        """
        Sanitize content to remove sensitive information and potential security risks.
        
        Args:
            content: Content to be sanitized
            
        Returns:
            Sanitized content
        """
        if isinstance(content, dict):
            return {
                self._sanitize_content(k): self._sanitize_content(v)
                for k, v in content.items()
            }
        elif isinstance(content, str):
            # Remove potential sensitive patterns (e.g., passwords, tokens)
            sensitive_patterns = ['password', 'token', 'secret', 'key']
            for pattern in sensitive_patterns:
                if pattern in content.lower():
                    return f"[REDACTED {pattern.upper()}]"
        return content

    def _initialize_monitoring_context(self, context: Optional[Dict] = None) -> Dict:
        """
        Initialize monitoring context with system state information.
        
        Args:
            context: Additional monitoring context
            
        Returns:
            Complete monitoring context dictionary
        """
        base_context = {
            'timestamp': self.timestamp.isoformat(),
            'error_id': self.error_id,
            'status_code': self.status_code,
            'error_type': self.__class__.__name__
        }
        
        if context:
            base_context.update(context)
            
        return base_context

    def to_dict(self) -> Dict:
        """
        Convert exception to dictionary format for API responses.
        
        Returns:
            Dictionary representation of the exception
        """
        return {
            'error': {
                'id': self.error_id,
                'message': self.message,
                'status_code': self.status_code,
                'timestamp': self.timestamp.isoformat(),
                'details': self.details
            }
        }

    def log_error(self) -> None:
        """Log error details to the monitoring system."""
        log_data = {
            'error_id': self.error_id,
            'message': self.message,
            'status_code': self.status_code,
            'details': self.details,
            'monitoring_context': self.monitoring_context
        }
        logger.error(f"Application error occurred: {self.error_id}", extra=log_data)


class AuthenticationError(BaseAppException):
    """
    Exception raised for authentication-related errors with security monitoring integration.
    
    Attributes:
        auth_type (str): Type of authentication that failed
        security_context (dict): Security-related context information
        failed_attempts (list): Track of failed authentication attempts
    """
    
    def __init__(
        self,
        message: str,
        details: Optional[Dict] = None,
        auth_type: Optional[str] = None,
        security_context: Optional[Dict] = None
    ) -> None:
        """
        Initialize authentication error with security context.
        
        Args:
            message: Human-readable error description
            details: Additional error context
            auth_type: Type of authentication that failed
            security_context: Security-related context information
        """
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details
        )
        
        self.auth_type = auth_type or 'unknown'
        self.security_context = self._initialize_security_context(security_context)
        self.failed_attempts = []
        
        # Track failed attempt
        self._track_failed_attempt()
        
        # Check for security threshold
        self._check_security_threshold()

    def _initialize_security_context(self, context: Optional[Dict] = None) -> Dict:
        """
        Initialize security context with request details.
        
        Args:
            context: Additional security context
            
        Returns:
            Complete security context dictionary
        """
        base_context = {
            'auth_type': self.auth_type,
            'timestamp': self.timestamp.isoformat(),
            'error_id': self.error_id
        }
        
        if context:
            base_context.update(self._sanitize_content(context))
            
        return base_context

    def _track_failed_attempt(self) -> None:
        """Track failed authentication attempt."""
        attempt = {
            'timestamp': self.timestamp.isoformat(),
            'error_id': self.error_id,
            'auth_type': self.auth_type
        }
        self.failed_attempts.append(attempt)

    def _check_security_threshold(self) -> None:
        """Check if security threshold is exceeded and trigger alert if necessary."""
        THRESHOLD_WINDOW = 300  # 5 minutes in seconds
        THRESHOLD_COUNT = 5     # Maximum failed attempts
        
        # Filter attempts within threshold window
        recent_attempts = [
            attempt for attempt in self.failed_attempts
            if (datetime.now(timezone.utc) - datetime.fromisoformat(attempt['timestamp'])).total_seconds() < THRESHOLD_WINDOW
        ]
        
        if len(recent_attempts) >= THRESHOLD_COUNT:
            self._trigger_security_alert()

    def _trigger_security_alert(self) -> None:
        """Trigger security monitoring alert for excessive failed attempts."""
        alert_data = {
            'error_id': self.error_id,
            'auth_type': self.auth_type,
            'failed_attempts': self.failed_attempts,
            'security_context': self.security_context
        }
        logger.warning(
            f"Security alert: Multiple authentication failures detected: {self.error_id}",
            extra=alert_data
        )

    def get_security_context(self) -> Dict:
        """
        Get security context information.
        
        Returns:
            Security context dictionary
        """
        return {
            'security_context': self.security_context,
            'failed_attempts': self.failed_attempts,
            'auth_type': self.auth_type
        }