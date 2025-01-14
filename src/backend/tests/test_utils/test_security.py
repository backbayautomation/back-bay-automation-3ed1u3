"""
Comprehensive test suite for security utility functions including input validation,
data masking, token generation, security event logging, and data hashing functionality.

Version: 1.0.0
"""

import pytest  # version: ^7.4.0
from unittest.mock import patch, MagicMock  # version: latest
import re
import json
import logging
from datetime import datetime

from app.utils.security import (
    validate_input,
    mask_sensitive_data,
    generate_secure_token,
    log_security_event,
    hash_data
)

class TestSecurityUtils:
    """Comprehensive test suite for security utility functions with enhanced coverage."""

    @pytest.fixture
    def mock_logger(self):
        """Fixture for mocking security logger."""
        with patch('app.utils.security.SECURITY_LOGGER') as mock:
            yield mock

    def test_validate_input_valid_patterns(self):
        """Test input validation with various valid pattern types."""
        # Test valid email patterns
        assert validate_input("user@example.com", "email") is True
        assert validate_input("test.user+label@domain.co.uk", "email") is True

        # Test valid URL patterns
        assert validate_input("https://example.com", "url") is True
        assert validate_input("https://sub.domain.com/path?query=1", "url") is True

        # Test valid client_id patterns
        valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
        assert validate_input(valid_uuid, "client_id") is True

        # Test valid phone patterns
        assert validate_input("+1234567890", "phone") is True
        assert validate_input("12345678901", "phone") is True

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

    def test_validate_input_edge_cases(self):
        """Test input validation with edge cases and boundary conditions."""
        # Test empty input
        assert validate_input("", "email") is False
        assert validate_input(None, "email") is False

        # Test maximum length input
        long_input = "a" * 1000
        assert validate_input(long_input, "username") is False

        # Test unicode characters
        assert validate_input("üser@domain.com", "email") is True
        assert validate_input("测试@domain.com", "email") is True

        # Test invalid pattern names
        assert validate_input("test", "nonexistent_pattern") is False

    def test_mask_sensitive_data_types(self):
        """Test data masking with various data types and structures."""
        # Test credit card masking
        data = {
            "credit_card": "4111-1111-1111-1111",
            "name": "John Doe",
            "api_key": "sk_test_1234567890"
        }
        masked = mask_sensitive_data(data)
        assert masked["credit_card"] == "4111-1111-1111-1111"  # Not sensitive by default
        assert masked["name"] == "John Doe"
        assert masked["api_key"] == "****"

        # Test password masking
        data = {
            "username": "user",
            "password": "secret123",
            "token": "eyJ0eXAi..."
        }
        masked = mask_sensitive_data(data)
        assert masked["username"] == "user"
        assert masked["password"] == "****"
        assert masked["token"] == "****"

    def test_mask_sensitive_data_nested(self):
        """Test data masking in nested data structures."""
        # Test nested dictionary
        nested_data = {
            "user": {
                "name": "John",
                "credentials": {
                    "api_key": "secret123",
                    "password": "pass123"
                }
            },
            "settings": {
                "token": "abc123",
                "display": "dark"
            }
        }
        masked = mask_sensitive_data(nested_data)
        assert masked["user"]["credentials"]["api_key"] == "****"
        assert masked["user"]["credentials"]["password"] == "****"
        assert masked["settings"]["token"] == "****"
        assert masked["user"]["name"] == "John"
        assert masked["settings"]["display"] == "dark"

        # Test list in dictionary
        list_data = {
            "users": [
                {"name": "John", "api_key": "key1"},
                {"name": "Jane", "api_key": "key2"}
            ]
        }
        masked = mask_sensitive_data(list_data)
        assert all(user["api_key"] == "****" for user in masked["users"])
        assert all(user["name"] != "****" for user in masked["users"])

    def test_generate_secure_token_strength(self):
        """Test secure token generation strength and randomness."""
        # Test token length
        token = generate_secure_token(32)
        assert len(token) == 32

        # Test uniqueness
        tokens = [generate_secure_token(32) for _ in range(1000)]
        assert len(set(tokens)) == 1000  # All tokens should be unique

        # Test character distribution
        token = generate_secure_token(1000)
        char_counts = {}
        for char in token:
            char_counts[char] = char_counts.get(char, 0) + 1
        
        # Check for relatively even distribution
        avg_count = len(token) / len(char_counts)
        assert all(0.5 * avg_count <= count <= 1.5 * avg_count 
                  for count in char_counts.values())

        # Test minimum length requirement
        with pytest.raises(ValueError):
            generate_secure_token(8)  # Too short

    def test_log_security_event_compliance(self, mock_logger):
        """Test security event logging for compliance requirements."""
        # Test successful login event
        event_data = {
            "user_id": "123",
            "ip_address": "192.168.1.1",
            "action": "login",
            "password": "secret123"  # Should be masked
        }
        log_security_event("user_login", event_data)
        
        # Verify logging call
        mock_logger.info.assert_called_once()
        log_call = mock_logger.info.call_args[1]
        assert "password" not in json.dumps(log_call)
        assert "user_id" in json.dumps(log_call)
        assert "ip_address" in json.dumps(log_call)

        # Test failed login attempt
        mock_logger.reset_mock()
        event_data = {
            "user_id": "123",
            "ip_address": "192.168.1.1",
            "error": "Invalid credentials"
        }
        log_security_event("login_failed", event_data, "WARNING")
        mock_logger.warning.assert_called_once()

    def test_hash_data_security(self):
        """Test data hashing security properties."""
        # Test basic hashing
        data = "test_data"
        hash1 = hash_data(data)
        assert len(hash1) == 64  # SHA-256 produces 64 char hex string
        assert re.match(r'^[a-f0-9]{64}$', hash1)  # Valid hex format

        # Test collision resistance
        similar_data = "test_data1"
        hash2 = hash_data(similar_data)
        assert hash1 != hash2  # Small change should produce different hash

        # Test deterministic output
        assert hash_data(data) == hash1  # Same input should produce same hash

        # Test empty input
        with pytest.raises(ValueError):
            hash_data("")

        # Test None input
        with pytest.raises(ValueError):
            hash_data(None)

def test_security_utils_performance():
    """Test performance characteristics of security utilities."""
    # Test token generation performance
    start_time = datetime.now()
    for _ in range(1000):
        generate_secure_token(32)
    token_gen_time = (datetime.now() - start_time).total_seconds()
    assert token_gen_time < 1.0  # Should complete within 1 second

    # Test hash performance
    start_time = datetime.now()
    data = "x" * 10000  # 10KB string
    for _ in range(1000):
        hash_data(data)
    hash_time = (datetime.now() - start_time).total_seconds()
    assert hash_time < 2.0  # Should complete within 2 seconds

def pytest_configure(config):
    """Configure pytest environment for security testing."""
    # Configure logging for tests
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Set up test environment variables
    import os
    os.environ['SECURITY_TEST_MODE'] = 'True'