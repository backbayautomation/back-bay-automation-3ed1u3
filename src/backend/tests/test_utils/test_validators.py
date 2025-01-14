"""
Comprehensive unit tests for validation utility functions with enhanced security checks,
multi-tenant isolation, and format compliance verification.

Version: 1.0.0
"""

import pytest
import uuid
from datetime import datetime
from typing import List, Dict, Any

from app.utils.validators import (
    validate_email,
    validate_password,
    validate_document_type,
    validate_uuid,
    validate_chat_message
)

# Test data constants
VALID_TEST_EMAILS = [
    "user@example.com",
    "test.user@domain.co.uk",
    "user+label@domain.com",
    "first.last@subdomain.example.com",
    "user@münchen.de"
]

INVALID_TEST_EMAILS = [
    "invalid@",
    "@domain.com",
    "no-at-sign",
    "spaces in@email.com",
    "unicode☺@domain.com",
    "user@.com",
    ".user@domain.com",
    "user@domain..com",
    "a" * 255 + "@domain.com"  # Exceeds max length
]

VALID_TEST_PASSWORDS = [
    "SecureP@ssw0rd123",
    "C0mpl3x!P@ssphrase",
    "Str0ng&P@ssw0rd",
    "V3ry$3cur3P@ss",
    "P@ssw0rd!2024"
]

INVALID_TEST_PASSWORDS = [
    "short1!",  # Too short
    "nouppercasepass1!",  # No uppercase
    "NOLOWERCASE123!",  # No lowercase
    "NoSpecialChar123",  # No special char
    "NoNumbers!@#",  # No numbers
    "a" * 129  # Exceeds max length
]

VALID_TEST_UUIDS = [
    "123e4567-e89b-12d3-a456-426614174000",
    "987fcdeb-51a2-43f7-91d8-5b8ef9b7d241",
    "550e8400-e29b-41d4-a716-446655440000"
]

INVALID_TEST_UUIDS = [
    "invalid-uuid",
    "123",
    "",
    "not-a-uuid-at-all",
    "123e4567-e89b-12d3-a456"  # Incomplete UUID
]

TEST_TENANT_IDS = [
    "550e8400-e29b-41d4-a716-446655440000",
    "987fcdeb-51a2-43f7-91d8-5b8ef9b7d241"
]

@pytest.mark.parametrize("email,expected_valid,expected_message", [
    (email, True, "") for email in VALID_TEST_EMAILS
] + [
    (email, False, "Invalid email format") for email in INVALID_TEST_EMAILS
])
def test_validate_email(email: str, expected_valid: bool, expected_message: str) -> None:
    """Test email validation with comprehensive format checks."""
    # Execute validation
    is_valid, message = validate_email(email)
    
    # Verify results
    assert is_valid == expected_valid
    if not expected_valid:
        assert expected_message in message

@pytest.mark.parametrize("password,expected_valid,expected_message", [
    (password, True, "") for password in VALID_TEST_PASSWORDS
] + [
    (password, False, "Invalid password") for password in INVALID_TEST_PASSWORDS
])
def test_validate_password(password: str, expected_valid: bool, expected_message: str) -> None:
    """Test password validation with strict security requirements."""
    # Execute validation
    is_valid, message = validate_password(password)
    
    # Verify results
    assert is_valid == expected_valid
    if not expected_valid:
        assert expected_message in message

@pytest.mark.parametrize("content,filename,expected_valid,expected_type,expected_message", [
    (b"%PDF-1.5", "test.pdf", True, "application/pdf", ""),
    (b"PK\x03\x04", "test.docx", True, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ""),
    (b"PK\x03\x04", "test.xlsx", True, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ""),
    (b"invalid", "test.pdf", False, "", "Invalid file signature"),
    (b"", "test.docx", False, "", "Invalid file content"),
    (b"A" * (50 * 1024 * 1024 + 1), "large.pdf", False, "", "File size exceeds maximum"),
    (b"%PDF-1.5", "test.txt", False, "", "Unsupported file type")
])
def test_validate_document_type(
    content: bytes,
    filename: str,
    expected_valid: bool,
    expected_type: str,
    expected_message: str
) -> None:
    """Test document validation with file signature verification."""
    # Execute validation
    is_valid, message, detected_type = validate_document_type(content, filename)
    
    # Verify results
    assert is_valid == expected_valid
    if expected_valid:
        assert detected_type == expected_type
    else:
        assert expected_message in message

@pytest.mark.parametrize("uuid_string,expected_valid,expected_message", [
    (uuid_str, True, "") for uuid_str in VALID_TEST_UUIDS
] + [
    (uuid_str, False, "Invalid UUID format") for uuid_str in INVALID_TEST_UUIDS
])
def test_validate_uuid(uuid_string: str, expected_valid: bool, expected_message: str) -> None:
    """Test UUID validation for secure resource identification."""
    # Execute validation
    is_valid, message = validate_uuid(uuid_string)
    
    # Verify results
    assert is_valid == expected_valid
    if not expected_valid:
        assert expected_message in message

@pytest.mark.parametrize("content,role,tenant_id,expected_valid,expected_message", [
    ("Valid message", "user", TEST_TENANT_IDS[0], True, ""),
    ("System response", "system", TEST_TENANT_IDS[0], True, ""),
    ("", "user", TEST_TENANT_IDS[0], False, "Message content cannot be empty"),
    ("A" * 4097, "user", TEST_TENANT_IDS[0], False, "Message exceeds maximum length"),
    ("<script>alert('xss')</script>", "user", TEST_TENANT_IDS[0], False, "Message contains blocked content"),
    ("Valid message", "invalid_role", TEST_TENANT_IDS[0], False, "Invalid message role"),
    ("Valid message", "user", "invalid-tenant", False, "Invalid tenant ID"),
    ("Valid message", "user", "", False, "Invalid tenant ID")
])
def test_validate_chat_message(
    content: str,
    role: str,
    tenant_id: str,
    expected_valid: bool,
    expected_message: str
) -> None:
    """Test chat message validation with content security and tenant isolation."""
    # Execute validation
    is_valid, message, sanitized_content = validate_chat_message(content, role, tenant_id)
    
    # Verify results
    assert is_valid == expected_valid
    if not expected_valid:
        assert expected_message in message
    else:
        assert sanitized_content == content

def test_validate_email_with_domain_verification() -> None:
    """Test email validation with domain MX record verification."""
    # Test with verify_domain=True
    is_valid, message = validate_email("user@gmail.com", verify_domain=True)
    assert is_valid
    assert message == ""
    
    # Test with non-existent domain
    is_valid, message = validate_email("user@nonexistent-domain-12345.com", verify_domain=True)
    assert not is_valid
    assert "Domain does not exist" in message

def test_validate_password_complexity() -> None:
    """Test password validation with enhanced complexity requirements."""
    # Test entropy calculation
    low_entropy = "Abcd123!"  # Meets basic requirements but low entropy
    is_valid, message = validate_password(low_entropy)
    assert not is_valid
    assert "not complex enough" in message
    
    # Test with common password patterns
    common_pattern = "Password123!"
    is_valid, message = validate_password(common_pattern)
    assert not is_valid
    assert "common password pattern" in message

def test_validate_document_type_with_metadata() -> None:
    """Test document validation with enhanced metadata checks."""
    # Create PDF with metadata
    pdf_content = b"%PDF-1.5\n%metadata"
    is_valid, message, detected_type = validate_document_type(
        pdf_content,
        "test.pdf",
        max_size_bytes=1024
    )
    assert is_valid
    assert detected_type == "application/pdf"
    
    # Test with corrupted PDF
    corrupted_pdf = b"%PDF-1.5\n" + b"\x00" * 100
    is_valid, message, detected_type = validate_document_type(
        corrupted_pdf,
        "corrupted.pdf"
    )
    assert not is_valid
    assert "Invalid file signature" in message

def test_validate_uuid_version() -> None:
    """Test UUID validation with version checking."""
    # Test UUID v4
    uuid_v4 = str(uuid.uuid4())
    is_valid, message = validate_uuid(uuid_v4, version=4)
    assert is_valid
    assert message == ""
    
    # Test UUID v1
    uuid_v1 = str(uuid.uuid1())
    is_valid, message = validate_uuid(uuid_v1, version=4)
    assert not is_valid
    assert "Invalid UUID version" in message

def test_validate_chat_message_with_sanitization() -> None:
    """Test chat message validation with enhanced content sanitization."""
    # Test HTML content
    html_content = "<p>Valid content with <b>formatting</b></p>"
    is_valid, message, sanitized = validate_chat_message(
        html_content,
        "user",
        TEST_TENANT_IDS[0]
    )
    assert is_valid
    assert "<p>" not in sanitized
    assert "formatting" in sanitized
    
    # Test with malicious content
    malicious = "Valid message <img src=x onerror=alert(1)>"
    is_valid, message, sanitized = validate_chat_message(
        malicious,
        "user",
        TEST_TENANT_IDS[0]
    )
    assert is_valid
    assert "<img" not in sanitized
    assert "Valid message" in sanitized