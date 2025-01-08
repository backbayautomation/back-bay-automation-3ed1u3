"""
Comprehensive test suite for security utility functions with enhanced coverage
for input validation, data masking, token generation, security event logging,
and data hashing functionality.

Version: 1.0.0
"""

import pytest  # version: ^7.4.0
from unittest.mock import patch, MagicMock  # version: latest
import re
import json
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

    def test_validate_input_valid_patterns(self):
        """Test input validation with various valid pattern types."""
        # Test valid email patterns
        assert validate_input("user@example.com", "email") is True
        assert validate_input("test.user+label@domain.co.uk", "email") is True
        
        # Test valid username patterns
        assert validate_input("valid_user123", "username") is True
        assert validate_input("test-user", "username") is True
        
        # Test valid password patterns
        assert validate_input("SecurePass123!", "password") is True
        assert validate_input("Complex@Pass789", "password") is True

    def test_validate_input_invalid_patterns(self):
        """Test input validation with invalid and malicious patterns."""
        # Test SQL injection patterns
        assert validate_input("admin'--", "username") is False
        assert validate_input("1' OR '1'='1", "username") is False
        
        # Test XSS attack patterns
        assert validate_input("<script>alert(1)</script>", "username") is False
        assert validate_input("javascript:alert(1)", "username") is False
        
        # Test invalid email patterns
        assert validate_input("invalid@email", "email") is False
        assert validate_input("@domain.com", "email") is False
        assert validate_input("user@.com", "email") is False

    def test_validate_input_edge_cases(self):
        """Test input validation with edge cases and boundary conditions."""
        # Test empty and None inputs
        assert validate_input("", "email") is False
        assert validate_input(None, "username") is False
        
        # Test maximum length inputs
        long_input = "a" * 100
        assert validate_input(long_input, "username") is False
        
        # Test unicode and special characters
        assert validate_input("użytkownik@domain.com", "email") is True
        assert validate_input("user™@domain.com", "email") is False
        
        # Test invalid pattern names
        assert validate_input("test", "nonexistent_pattern") is False

    def test_mask_sensitive_data_types(self):
        """Test data masking with various data types and structures."""
        # Test credit card masking
        data = {
            "card_number": "4111111111111111",
            "cvv": "123",
            "expiry": "12/25"
        }
        masked = mask_sensitive_data(data)
        assert masked["card_number"] == "****"
        assert masked["cvv"] == "****"
        
        # Test API key masking
        data = {
            "api_key": "sk_test_1234567890abcdef",
            "public_key": "pk_test_abcdef1234567890"
        }
        masked = mask_sensitive_data(data)
        assert masked["api_key"] == "****"
        assert masked["public_key"].startswith("pk_test_")

    def test_mask_sensitive_data_nested(self):
        """Test data masking in nested data structures."""
        # Test nested dictionary
        nested_data = {
            "user": {
                "password": "secret123",
                "token": "eyJ0eXAiOiJKV1QiLCJhbGc",
                "profile": {
                    "name": "John Doe",
                    "secret_question": "mother's maiden name"
                }
            }
        }
        masked = mask_sensitive_data(nested_data)
        assert masked["user"]["password"] == "****"
        assert masked["user"]["token"] == "****"
        assert masked["user"]["profile"]["name"] == "John Doe"

        # Test mixed data types
        complex_data = {
            "credentials": {
                "password": "secret",
                "tokens": ["token1", "token2"],
                "api_keys": {
                    "primary": "key1",
                    "secondary": "key2"
                }
            }
        }
        masked = mask_sensitive_data(complex_data)
        assert masked["credentials"]["password"] == "****"
        assert all(t == "****" for t in masked["credentials"]["tokens"])
        assert all(k == "****" for k in masked["credentials"]["api_keys"].values())

    def test_generate_secure_token_strength(self):
        """Test secure token generation strength and randomness."""
        # Test token uniqueness
        tokens = [generate_secure_token() for _ in range(1000)]
        assert len(set(tokens)) == len(tokens)  # All tokens should be unique
        
        # Test token length
        token = generate_secure_token(length=48)
        assert len(token) == 48
        
        # Test token entropy
        token = generate_secure_token()
        # Check character distribution
        char_counts = {}
        for char in token:
            char_counts[char] = char_counts.get(char, 0) + 1
        # Ensure good distribution of characters
        avg_count = len(token) / len(char_counts)
        assert all(0.5 <= count/avg_count <= 1.5 for count in char_counts.values())
        
        # Test invalid lengths
        with pytest.raises(ValueError):
            generate_secure_token(length=8)  # Too short
        with pytest.raises(ValueError):
            generate_secure_token(length=-1)  # Negative length

    def test_log_security_event_compliance(self):
        """Test security event logging for compliance requirements."""
        with patch('app.utils.security.SECURITY_LOGGER') as mock_logger:
            # Test successful login event
            event_data = {
                "user_id": "12345",
                "ip_address": "192.168.1.1",
                "action": "login",
                "timestamp": datetime.utcnow().isoformat()
            }
            log_security_event("login_success", event_data)
            mock_logger.info.assert_called_once()
            
            # Test failed login attempt
            mock_logger.reset_mock()
            event_data.update({"password": "attempted_password"})
            log_security_event("login_failed", event_data, "WARNING")
            # Verify password was masked
            call_args = mock_logger.warning.call_args[0][0]
            assert "attempted_password" not in call_args
            assert "[MASKED]" in call_args or "****" in call_args

            # Test critical security event
            mock_logger.reset_mock()
            event_data = {
                "alert_type": "brute_force_detected",
                "ip_address": "192.168.1.1",
                "attempts": 10
            }
            log_security_event("security_breach", event_data, "CRITICAL")
            mock_logger.critical.assert_called_once()

    def test_hash_data_security(self):
        """Test data hashing security properties."""
        # Test basic hashing
        data = "sensitive_data"
        hash1 = hash_data(data)
        assert len(hash1) == 64  # SHA-256 produces 64 character hex string
        assert re.match(r'^[a-f0-9]{64}$', hash1)  # Valid hex format
        
        # Test consistency
        hash2 = hash_data(data)
        assert hash1 == hash2  # Same input should produce same hash
        
        # Test avalanche effect
        slightly_different = "sensitive_datA"
        hash3 = hash_data(slightly_different)
        assert hash1 != hash3  # Small change should produce very different hash
        
        # Test empty input
        with pytest.raises(ValueError):
            hash_data("")
        with pytest.raises(ValueError):
            hash_data(None)

def pytest_configure(config):
    """Configure pytest environment for security testing."""
    # Configure test logging
    config.addinivalue_line(
        "markers",
        "security: mark test as security-related"
    )