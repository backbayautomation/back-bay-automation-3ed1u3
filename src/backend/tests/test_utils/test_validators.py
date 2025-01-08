import pytest
import uuid
from datetime import datetime
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
    "international@münchen.de",
    "user.name@company-domain.com",
    "first.last@subdomain.domain.org"
]

INVALID_TEST_EMAILS = [
    "invalid@",
    "@domain.com",
    "no-at-sign",
    "",
    "user@domain",
    "user name@domain.com",
    "user@.com",
    "user@domain..com",
    "very.long." + "x"*250 + "@domain.com"
]

VALID_TEST_PASSWORDS = [
    "SecureP@ssw0rd123",
    "C0mpl3x!P@ssphrase",
    "Str0ng&P@ssw0rd",
    "P@ssw0rd$2024XYZ",
    "MyP@ssw0rd!2024"
]

INVALID_TEST_PASSWORDS = [
    "short1!",  # Too short
    "nouppercasepass1!",  # No uppercase
    "NOLOWERCASE123!",  # No lowercase
    "NoSpecialChar123",  # No special char
    "NoNumber@Password",  # No number
    "Ab1!" + "x"*200  # Too long
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
    "123e4567-e89b-12d3-a456",  # Incomplete
    "123e4567-e89b-12d3-a456-42661417400z"  # Invalid char
]

TEST_TENANT_IDS = [
    "550e8400-e29b-41d4-a716-446655440000",
    "987fcdeb-51a2-43f7-91d8-5b8ef9b7d241",
    "123e4567-e89b-12d3-a456-426614174000"
]

@pytest.mark.parametrize("email,expected_valid,expected_message", [
    (email, True, "") for email in VALID_TEST_EMAILS
] + [
    (email, False, "Invalid email format") for email in INVALID_TEST_EMAILS
])
def test_validate_email(email, expected_valid, expected_message):
    """Test email validation with various formats and security checks."""
    # Test with verify_domain=False to avoid actual DNS lookups in tests
    is_valid, message = validate_email(email, verify_domain=False)
    assert is_valid == expected_valid
    if not expected_valid:
        assert message == expected_message

@pytest.mark.parametrize("password,expected_valid,expected_message", [
    (password, True, "") for password in VALID_TEST_PASSWORDS
] + [
    ("short1!", False, "Password must be at least 12 characters"),
    ("nouppercasepass1!", False, "Password must contain uppercase letter"),
    ("NOLOWERCASE123!", False, "Password must contain lowercase letter"),
    ("NoSpecialChar123", False, "Password must contain special character"),
    ("NoNumber@Password", False, "Password must contain number")
])
def test_validate_password(password, expected_valid, expected_message):
    """Test password validation with security requirements and strength checks."""
    is_valid, message = validate_password(password)
    assert is_valid == expected_valid
    if not expected_valid:
        assert message == expected_message

@pytest.mark.parametrize("content,filename,expected_valid,expected_type,expected_message", [
    (b"%PDF-1.5\n", "test.pdf", True, "application/pdf", ""),
    (b"PK\x03\x04", "test.docx", True, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ""),
    (b"PK\x03\x04", "test.xlsx", True, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ""),
    (b"invalid", "test.pdf", False, "", "File extension does not match content"),
    (b"", "test.docx", False, "", "Validation error occurred"),
    (b"A"*52428800, "test.pdf", False, "", "File exceeds maximum size"),
    (b"test", "test.txt", False, "", "File type not allowed")
])
def test_validate_document_type(content, filename, expected_valid, expected_type, expected_message):
    """Test document validation with file signature verification and security checks."""
    is_valid, message, detected_type = validate_document_type(content, filename)
    assert is_valid == expected_valid
    if expected_valid:
        assert detected_type == expected_type
    else:
        assert message == expected_message

@pytest.mark.parametrize("uuid_string,expected_valid,expected_message", [
    (uuid_str, True, "") for uuid_str in VALID_TEST_UUIDS
] + [
    (uuid_str, False, "Invalid UUID format") for uuid_str in INVALID_TEST_UUIDS
])
def test_validate_uuid(uuid_string, expected_valid, expected_message):
    """Test UUID validation for secure resource identification."""
    is_valid, message = validate_uuid(uuid_string)
    assert is_valid == expected_valid
    if not expected_valid:
        assert message == expected_message

@pytest.mark.parametrize("content,role,tenant_id,expected_valid,expected_message", [
    ("Valid message", "user", TEST_TENANT_IDS[0], True, ""),
    ("System response", "system", TEST_TENANT_IDS[1], True, ""),
    ("", "user", TEST_TENANT_IDS[0], False, "Content length must be between 1 and 4096 characters"),
    ("A"*5000, "user", TEST_TENANT_IDS[0], False, "Content length must be between 1 and 4096 characters"),
    ("Valid message", "invalid", TEST_TENANT_IDS[0], False, "Invalid role"),
    ("Valid message", "user", "invalid-uuid", False, "Invalid tenant ID"),
    ("<script>alert('xss')</script>", "user", TEST_TENANT_IDS[0], False, "Content contains blocked patterns"),
    ("javascript:alert(1)", "user", TEST_TENANT_IDS[0], False, "Content contains blocked patterns")
])
def test_validate_chat_message(content, role, tenant_id, expected_valid, expected_message):
    """Test chat message validation with content security and tenant isolation."""
    is_valid, message, sanitized = validate_chat_message(content, role, tenant_id)
    assert is_valid == expected_valid
    if not expected_valid:
        assert message == expected_message
    else:
        assert sanitized  # Ensure sanitized content is returned for valid messages