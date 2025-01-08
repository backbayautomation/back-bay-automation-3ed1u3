"""
Comprehensive test suite for security utility functions with enhanced coverage for
edge cases, performance, and security vulnerabilities.

Version: 1.0.0
"""

import pytest  # version: 7.4.0
from unittest.mock import patch, MagicMock  # version: latest
import re
import json
import secrets
import hashlib
from typing import Dict, Any

from app.utils.security import (
    validate_input,
    mask_sensitive_data,
    generate_secure_token,
    log_security_event,
    hash_data
)

def pytest_configure(config):
    """Configure pytest environment for security testing."""
    # Configure test logging
    config.addinivalue_line(
        "markers",
        "security: mark test as security-related for enhanced logging"
    )

class TestSecurityUtils:
    """Comprehensive test suite for security utility functions with enhanced coverage."""

    @pytest.mark.security
    def test_validate_input_valid_patterns(self):
        """Test input validation with various valid pattern types."""
        # Test valid email patterns
        assert validate_input("user@example.com", "email") is True
        assert validate_input("test.user+label@sub.domain.com", "email") is True

        # Test valid URL patterns
        assert validate_input("https://example.com", "url") is True
        assert validate_input("https://sub.domain.com/path?param=value", "url") is True

        # Test valid client_id patterns
        valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
        assert validate_input(valid_uuid, "client_id") is True

        # Test valid phone patterns
        assert validate_input("+1234567890", "phone") is True
        assert validate_input("12345678901", "phone") is True

    @pytest.mark.security
    def test_validate_input_invalid_patterns(self):
        """Test input validation with invalid and malicious patterns."""
        # Test SQL injection patterns
        assert validate_input("'; DROP TABLE users;--", "username") is False
        assert validate_input("admin'--", "username") is False

        # Test XSS attack patterns
        assert validate_input("<script>alert('xss')</script>", "username") is False
        assert validate_input("javascript:alert(1)", "url") is False

        # Test command injection patterns
        assert validate_input("; rm -rf /", "username") is False
        assert validate_input("|| cat /etc/passwd", "username") is False

        # Test invalid email patterns
        assert validate_input("user@.com", "email") is False
        assert validate_input("@domain.com", "email") is False

    @pytest.mark.security
    def test_validate_input_edge_cases(self):
        """Test input validation with edge cases and boundary conditions."""
        # Test empty input
        assert validate_input("", "email") is False
        assert validate_input(None, "email") is False

        # Test maximum length input
        long_input = "a" * 256
        assert validate_input(long_input, "username") is False

        # Test unicode characters
        assert validate_input("用户@domain.com", "email") is False
        assert validate_input("user🔒@domain.com", "email") is False

        # Test special characters
        assert validate_input("user+test@domain.com", "email") is True
        assert validate_input("user name@domain.com", "email") is False

    @pytest.mark.security
    def test_mask_sensitive_data_types(self):
        """Test data masking with various data types and structures."""
        test_data = {
            "password": "secret123",
            "api_key": "ak_test_123456",
            "credit_card": "4111-1111-1111-1111",
            "ssn": "123-45-6789",
            "normal_field": "visible_data"
        }

        masked = mask_sensitive_data(test_data)

        assert masked["password"] == "****"
        assert masked["api_key"] == "****"
        assert masked["credit_card"] == "****"
        assert masked["ssn"] == "****"
        assert masked["normal_field"] == "visible_data"

    @pytest.mark.security
    def test_mask_sensitive_data_nested(self):
        """Test data masking in nested data structures."""
        nested_data = {
            "user": {
                "name": "John Doe",
                "credentials": {
                    "password": "secret123",
                    "api_key": "ak_test_123456"
                }
            },
            "payment": {
                "credit_card": "4111-1111-1111-1111",
                "cvv": "123"
            },
            "settings": {
                "public": True
            }
        }

        masked = mask_sensitive_data(nested_data)

        assert masked["user"]["credentials"]["password"] == "****"
        assert masked["user"]["credentials"]["api_key"] == "****"
        assert masked["payment"]["credit_card"] == "****"
        assert masked["payment"]["cvv"] == "****"
        assert masked["user"]["name"] == "John Doe"
        assert masked["settings"]["public"] is True

    @pytest.mark.security
    def test_generate_secure_token_strength(self):
        """Test secure token generation strength and randomness."""
        # Generate multiple tokens for analysis
        tokens = [generate_secure_token() for _ in range(1000)]

        # Test token uniqueness
        assert len(set(tokens)) == len(tokens), "Tokens must be unique"

        # Test token length and character set
        for token in tokens:
            assert len(token) == 32, "Token length must be 32 characters"
            assert re.match(r'^[A-Za-z0-9_-]+$', token), "Invalid token characters"

        # Test entropy using character distribution
        def calculate_entropy(token: str) -> float:
            char_count = {}
            for char in token:
                char_count[char] = char_count.get(char, 0) + 1
            length = len(token)
            return -sum((count/length) * (count/length) for count in char_count.values())

        # Verify minimum entropy threshold
        min_entropy = min(calculate_entropy(token) for token in tokens)
        assert min_entropy > 3.0, "Token entropy too low"

    @pytest.mark.security
    def test_log_security_event_compliance(self):
        """Test security event logging for compliance requirements."""
        with patch('app.utils.security.SECURITY_LOGGER') as mock_logger:
            # Test various security event types
            events = [
                ("authentication_failure", {"user_id": "123", "reason": "invalid_password"}),
                ("authorization_denied", {"user_id": "123", "resource": "admin_panel"}),
                ("rate_limit_exceeded", {"ip": "192.168.1.1", "endpoint": "/api/v1/users"}),
                ("suspicious_activity", {"user_id": "123", "activity": "multiple_failed_logins"})
            ]

            for event_type, event_data in events:
                log_security_event(event_type, event_data, "WARNING")
                
                # Verify logging calls
                mock_logger.warning.assert_called()
                
                # Verify sensitive data masking
                log_args = mock_logger.warning.call_args[1]['extra']
                assert isinstance(log_args, dict)
                assert 'environment' in log_args
                assert 'event_type' in log_args
                
                # Verify timestamp presence and format
                assert 'timestamp' in log_args

    @pytest.mark.security
    def test_hash_data_security(self):
        """Test data hashing security properties."""
        test_data = "sensitive_information_123"
        
        # Test basic hashing
        hash1 = hash_data(test_data)
        assert len(hash1) == 64, "SHA-256 hash must be 64 characters"
        assert re.match(r'^[a-f0-9]+$', hash1), "Invalid hash characters"

        # Test collision resistance
        similar_data = "sensitive_information_124"
        hash2 = hash_data(similar_data)
        assert hash1 != hash2, "Hash collision detected"

        # Test avalanche effect
        def bit_difference(hash1: str, hash2: str) -> int:
            bin1 = bin(int(hash1, 16))[2:].zfill(256)
            bin2 = bin(int(hash2, 16))[2:].zfill(256)
            return sum(b1 != b2 for b1, b2 in zip(bin1, bin2))

        bit_diff = bit_difference(hash1, hash2)
        assert bit_diff > 100, "Weak avalanche effect detected"

        # Test empty input handling
        with pytest.raises(ValueError):
            hash_data("")
        with pytest.raises(ValueError):
            hash_data(None)

        # Test performance under load
        import time
        start_time = time.time()
        for _ in range(1000):
            hash_data(test_data)
        execution_time = time.time() - start_time
        assert execution_time < 1.0, "Hashing performance too slow"