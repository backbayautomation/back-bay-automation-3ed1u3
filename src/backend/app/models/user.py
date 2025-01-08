"""
SQLAlchemy model defining the User entity for authentication, authorization and multi-tenant 
user management with enhanced security and audit features.

Version: 1.0.0
"""

from datetime import datetime
from enum import Enum
import re
from typing import Optional
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Integer  # version: ^1.4.0
from sqlalchemy.dialects.postgresql import UUID  # version: ^1.4.0
from sqlalchemy.orm import relationship, validates  # version: ^1.4.0

from ..db.base import Base
from ..core.security import get_password_hash

class UserRole(Enum):
    """Enumeration defining possible user roles in the system."""
    SYSTEM_ADMIN = "system_admin"
    CLIENT_ADMIN = "client_admin"
    REGULAR_USER = "regular_user"

class User(Base):
    """SQLAlchemy model representing a user with enhanced security and audit features."""
    __tablename__ = 'users'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, index=True,
               doc="Unique identifier for the user")
    org_id = Column(UUID, ForeignKey('organizations.id', ondelete='CASCADE'),
                   nullable=False, index=True,
                   doc="Organization ID for tenant isolation")
    client_id = Column(UUID, ForeignKey('clients.id', ondelete='CASCADE'),
                      nullable=True, index=True,
                      doc="Client ID for multi-tenant access")

    # User Information Fields
    email = Column(String(255), unique=True, nullable=False, index=True,
                  doc="User's email address")
    hashed_password = Column(String(255), nullable=False,
                           doc="Securely hashed user password")
    full_name = Column(String(100), nullable=False,
                      doc="User's full name")
    role = Column(String(20), nullable=False, default=UserRole.REGULAR_USER.value,
                 doc="User's role in the system")
    is_active = Column(Boolean, nullable=False, default=True,
                      doc="User account status")

    # Audit Fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       doc="Timestamp of user creation")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       onupdate=datetime.utcnow,
                       doc="Timestamp of last user update")
    last_login = Column(DateTime, nullable=True,
                       doc="Timestamp of last successful login")
    failed_login_attempts = Column(Integer, nullable=False, default=0,
                                 doc="Count of failed login attempts")
    last_ip_address = Column(String(45), nullable=True,
                           doc="Last IP address used for login")

    # Relationships
    organization = relationship("Organization", back_populates="users",
                              doc="Parent organization relationship")
    client = relationship("Client", back_populates="users",
                         doc="Associated client relationship")
    chat_sessions = relationship("ChatSession", back_populates="user",
                               cascade="all, delete-orphan",
                               doc="User's chat sessions")
    audit_logs = relationship("AuditLog", back_populates="user",
                            cascade="all, delete-orphan",
                            doc="User's audit trail")

    def set_password(self, password: str) -> None:
        """
        Hash and set user password with validation.

        Args:
            password: Plain text password to hash

        Raises:
            ValueError: If password doesn't meet complexity requirements
        """
        # Validate password complexity
        if len(password) < 12:
            raise ValueError("Password must be at least 12 characters long")
        if not re.search(r"[A-Z]", password):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", password):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", password):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            raise ValueError("Password must contain at least one special character")

        self.hashed_password = get_password_hash(password)
        self.failed_login_attempts = 0
        self.updated_at = datetime.utcnow()

    @validates('email')
    def validate_email(self, key: str, email: str) -> str:
        """
        Validate email format and uniqueness.

        Args:
            key: Field name being validated
            email: Email address to validate

        Returns:
            str: Validated email address

        Raises:
            ValueError: If email is invalid or already exists
        """
        if not email or not isinstance(email, str):
            raise ValueError("Email must be a non-empty string")

        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise ValueError("Invalid email format")

        # Convert to lowercase for consistency
        email = email.lower()

        return email

    @validates('role')
    def validate_role(self, key: str, role: str) -> str:
        """
        Validate user role assignment.

        Args:
            key: Field name being validated
            role: Role to validate

        Returns:
            str: Validated role value

        Raises:
            ValueError: If role is invalid
        """
        try:
            return UserRole(role).value
        except ValueError:
            raise ValueError(f"Invalid role: {role}")

    @validates('client_id')
    def validate_client_id(self, key: str, client_id: Optional[UUID]) -> Optional[UUID]:
        """
        Validate client ID based on user role.

        Args:
            key: Field name being validated
            client_id: Client ID to validate

        Returns:
            Optional[UUID]: Validated client ID

        Raises:
            ValueError: If client ID validation fails
        """
        if self.role == UserRole.SYSTEM_ADMIN.value:
            return None
        if not client_id:
            raise ValueError("Client ID is required for non-system admin users")
        return client_id

    def validate_tenant_access(self, tenant_id: UUID) -> bool:
        """
        Validate user's tenant access permissions.

        Args:
            tenant_id: Tenant ID to validate access for

        Returns:
            bool: True if access is allowed, False otherwise
        """
        if self.role == UserRole.SYSTEM_ADMIN.value:
            return True
        if self.role == UserRole.CLIENT_ADMIN.value:
            return str(self.client_id) == str(tenant_id)
        return str(self.client_id) == str(tenant_id)

    def __repr__(self) -> str:
        """String representation of the User instance."""
        return f"<User(email='{self.email}', role='{self.role}')>"