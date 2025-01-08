"""
SQLAlchemy model defining the User entity with comprehensive security, audit,
and multi-tenant features for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from datetime import datetime
import re
from enum import Enum
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates

from ..db.base import Base
from ..core.security import get_password_hash

# Password validation regex
PASSWORD_REGEX = r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{12,}$"
EMAIL_REGEX = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"

class UserRole(Enum):
    """Enumeration defining possible user roles in the system."""
    SYSTEM_ADMIN = "system_admin"
    CLIENT_ADMIN = "client_admin"
    REGULAR_USER = "regular_user"

class User(Base):
    """
    SQLAlchemy model representing a user with enhanced security and audit features.
    Implements comprehensive user management with role-based access control and
    multi-tenant security measures.
    """
    __tablename__ = "users"
    __table_args__ = {"schema": "tenant"}

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, index=True,
               doc="Unique identifier for the user")
    org_id = Column(UUID, ForeignKey("tenant.organizations.id", ondelete="CASCADE"),
                   nullable=False, index=True,
                   doc="Organization ID for tenant isolation")
    client_id = Column(UUID, ForeignKey("tenant.clients.id", ondelete="CASCADE"),
                      nullable=True, index=True,
                      doc="Client ID for client-specific users")

    # User Information Fields
    email = Column(String(255), unique=True, nullable=False, index=True,
                  doc="User's email address for authentication")
    hashed_password = Column(String(255), nullable=False,
                           doc="Securely hashed user password")
    full_name = Column(String(100), nullable=False,
                      doc="User's full name")
    role = Column(String(20), nullable=False, default=UserRole.REGULAR_USER.value,
                 doc="User's role for access control")
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
            password (str): Plain text password to hash and set

        Raises:
            ValueError: If password doesn't meet complexity requirements
        """
        if not re.match(PASSWORD_REGEX, password):
            raise ValueError(
                "Password must be at least 12 characters long and contain "
                "at least one letter, one number, and one special character"
            )

        self.hashed_password = get_password_hash(password)
        self.failed_login_attempts = 0
        self.updated_at = datetime.utcnow()

    @validates("email")
    def validate_email(self, key: str, email: str) -> str:
        """
        Validate email format and uniqueness.

        Args:
            key (str): Field name being validated
            email (str): Email address to validate

        Returns:
            str: Validated email address

        Raises:
            ValueError: If email is invalid or already exists
        """
        if not email or not isinstance(email, str):
            raise ValueError("Email must be a non-empty string")

        if not re.match(EMAIL_REGEX, email):
            raise ValueError("Invalid email format")

        email = email.lower().strip()
        
        # Check uniqueness (excluding self in case of updates)
        existing = User.query.filter(
            User.email == email,
            User.id != self.id
        ).first()
        if existing:
            raise ValueError("Email already registered")

        return email

    @validates("role")
    def validate_role(self, key: str, role: str) -> str:
        """
        Validate user role assignment.

        Args:
            key (str): Field name being validated
            role (str): Role to validate

        Returns:
            str: Validated role value

        Raises:
            ValueError: If role is invalid
        """
        try:
            return UserRole(role).value
        except ValueError:
            raise ValueError(f"Invalid role: {role}")

    @validates("client_id")
    def validate_tenant_access(self, key: str, client_id: UUID) -> UUID:
        """
        Validate user's tenant access permissions.

        Args:
            key (str): Field name being validated
            client_id (UUID): Client ID to validate

        Returns:
            UUID: Validated client ID

        Raises:
            ValueError: If tenant access is invalid
        """
        if client_id is None and self.role != UserRole.SYSTEM_ADMIN.value:
            raise ValueError("Non-system admin users must be associated with a client")

        if client_id is not None:
            # Verify client belongs to user's organization
            client = Client.query.filter_by(
                id=client_id,
                org_id=self.org_id
            ).first()
            if not client:
                raise ValueError("Invalid client ID for organization")

        return client_id

    def __repr__(self) -> str:
        """String representation of the User instance."""
        return f"<User(email='{self.email}', role='{self.role}')>"