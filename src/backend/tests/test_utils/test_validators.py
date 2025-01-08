import pytest
import uuid
from datetime import datetime
from typing import List, Tuple

from app.utils.validators import (
    validate_email,
    validate_password,
    validate_document_type,
    validate_uuid,
    validate_chat_message
)

# Test Data Constants
VALID_TEST_EMAILS = [
    "user@example.com",
    "test.user@domain.co.uk",
    "user+label@domain.com",
    "firstname.lastname@company.org",
    "user@subdomain.domain.com"
]

INVALID_TEST_EMAILS = [
    "invalid@",
    "@domain.com",
    "no-at-sign",
    "",
    "user@domain",
    "user@.com",
    "user@domain..com",
    "user name@domain.com",
    "user@-domain.com",
    "user@domain.com.",
    "a" * 255 + "@domain.com"  # Exceeds max length
]

VALID_TEST_PASSWORDS = [
    "SecureP@ssw0rd123",
    "C0mpl3x!P@ssphrase",
    "Str0ng&P@ssw0rd",
    "P@ssw0rd!2024Qz",
    "MyP@ssw0rd!123"
]

INVALID_TEST_PASSWORDS = [
    "short1!",  # Too short
    "nouppercasepass1!",  # No uppercase
    "NOLOWERCASE123!",  # No lowercase
    "NoSpecialChar123",  # No special char
    "NoNumbers!@#",  # No numbers
    "a" * 65 + "A1!",  # Exceeds max length
    "CommonPassword123!",  # Common password
    "Password123!",  # Common pattern
    "",  # Empty
    "Ab1!" * 3  # Too simple pattern
]

VALID_TEST_UUIDS = [
    "123e4567-e89b-12d3-a456-426614174000",
    "987fcdeb-51a2-43f7-91d8-5b8ef9b7d241",
    "550e8400-e29b-41d4-a716-446655440000",
    str(uuid.uuid4()),
    str(uuid.uuid4())
]

INVALID_TEST_UUIDS = [
    "invalid-uuid",
    "123",
    "",
    "not-a-uuid-at-all",
    "123e4567-e89b-12d3-a456",  # Incomplete
    "123e4567-e89b-12d3-a456-4266141740xx",  # Invalid chars
    "123e4567-e89b-12d3-a456-4266141740",  # Wrong length
]

TEST_TENANT_IDS = [str(uuid.uuid4()) for _ in range(3)]

@pytest.mark.parametrize("email,expected_valid,expected_message", [
    (email, True, "") for email in VALID_TEST_EMAILS
] + [
    (email, False, "Invalid email format") for email in INVALID_TEST_EMAILS
])
def test_validate_email(email: str, expected_valid: bool, expected_message: str) -> None:
    """Test email validation with comprehensive format checks."""
    # Act
    is_valid, message = validate_email(email, verify_domain=False)

    # Assert
    assert is_valid == expected_valid
    if not expected_valid:
        assert message != ""
        if expected_message:
            assert expected_message in message

@pytest.mark.parametrize("password,expected_valid,expected_message", [
    (password, True, "") for password in VALID_TEST_PASSWORDS
] + [
    (password, False, "Password validation failed") for password in INVALID_TEST_PASSWORDS
])
def test_validate_password(password: str, expected_valid: bool, expected_message: str) -> None:
    """Test password validation with strict security requirements."""
    # Act
    is_valid, message = validate_password(password)

    # Assert
    assert is_valid == expected_valid
    if not expected_valid:
        assert message != ""
        if expected_message:
            assert expected_message in message

@pytest.mark.parametrize("content,filename,expected_valid,expected_type,expected_message", [
    (b"%PDF-1.5", "test.pdf", True, "application/pdf", ""),
    (b"PK\x03\x04", "test.docx", True, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ""),
    (b"PK\x03\x04", "test.xlsx", True, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ""),
    (b"invalid", "test.pdf", False, "", "Unsupported file type"),
    (b"", "test.pdf", False, "", "Invalid file content"),
    (b"X5O!P%@AP", "test.pdf", False, "", "File contains suspicious content"),
    (b"A" * (50 * 1024 * 1024 + 1), "test.pdf", False, "", "File size exceeds maximum limit")
])
def test_validate_document_type(
    content: bytes,
    filename: str,
    expected_valid: bool,
    expected_type: str,
    expected_message: str
) -> None:
    """Test document validation with file signature verification."""
    # Act
    is_valid, message, detected_type = validate_document_type(content, filename)

    # Assert
    assert is_valid == expected_valid
    if expected_valid:
        assert detected_type == expected_type
    if not expected_valid:
        assert message != ""
        if expected_message:
            assert expected_message in message

@pytest.mark.parametrize("uuid_string,expected_valid,expected_message", [
    (uuid_str, True, "") for uuid_str in VALID_TEST_UUIDS
] + [
    (uuid_str, False, "Invalid UUID format") for uuid_str in INVALID_TEST_UUIDS
])
def test_validate_uuid(uuid_string: str, expected_valid: bool, expected_message: str) -> None:
    """Test UUID validation for secure resource identification."""
    # Act
    is_valid, message = validate_uuid(uuid_string)

    # Assert
    assert is_valid == expected_valid
    if not expected_valid:
        assert message != ""
        if expected_message:
            assert expected_message in message

@pytest.mark.parametrize("content,role,tenant_id,expected_valid,expected_message", [
    ("Valid message", "user", TEST_TENANT_IDS[0], True, ""),
    ("System response", "system", TEST_TENANT_IDS[0], True, ""),
    ("", "user", TEST_TENANT_IDS[0], False, "Content must be between 1 and 4096 characters"),
    ("A" * 4097, "user", TEST_TENANT_IDS[0], False, "Content must be between 1 and 4096 characters"),
    ("Valid message", "invalid_role", TEST_TENANT_IDS[0], False, "Invalid role"),
    ("Valid message", "user", "invalid-tenant", False, "Invalid tenant ID"),
    ("<script>alert('xss')</script>", "user", TEST_TENANT_IDS[0], False, "Content contains blocked patterns"),
    ("javascript:alert(1)", "user", TEST_TENANT_IDS[0], False, "Content contains blocked patterns"),
    ("Normal message", "user", "", False, "Invalid tenant ID")
])
def test_validate_chat_message(
    content: str,
    role: str,
    tenant_id: str,
    expected_valid: bool,
    expected_message: str
) -> None:
    """Test chat message validation with content security and tenant isolation."""
    # Act
    is_valid, message, sanitized = validate_chat_message(content, role, tenant_id)

    # Assert
    assert is_valid == expected_valid
    if not expected_valid:
        assert message != ""
        if expected_message:
            assert expected_message in message
    if expected_valid:
        assert sanitized != ""
        assert len(sanitized) <= 4096
        assert "<script" not in sanitized.lower()
        assert "javascript:" not in sanitized.lower()