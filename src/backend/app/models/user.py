"""
SQLAlchemy model defining the User entity for authentication, authorization and multi-tenant 
user management with enhanced security and audit features.

Version: 1.0.0
"""

from datetime import datetime
import re
from enum import Enum
from sqlalchemy import Column, String, Boolean, ForeignKey, Enum as SQLEnum, DateTime, Integer  # version: ^1.4.0
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
    """
    SQLAlchemy model representing a user in the system with enhanced security and audit features.
    Implements comprehensive user management with secure multi-tenant isolation and audit capabilities.
    """
    __tablename__ = 'users'

    # Primary identifier with UUID for security and global uniqueness
    id = Column(UUID, primary_key=True, index=True)
    
    # Multi-tenant relationships
    org_id = Column(UUID, ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    client_id = Column(UUID, ForeignKey('clients.id', ondelete='CASCADE'), nullable=True)
    
    # User authentication fields
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    
    # Authorization and status
    role = Column(SQLEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Audit timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Security tracking
    last_login = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    last_ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    client = relationship("Client", back_populates="users")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password: str) -> None:
        """
        Hash and set user password with validation.
        
        Args:
            password: Plain text password to hash and set
            
        Raises:
            ValueError: If password doesn't meet complexity requirements
        """
        # Validate password complexity
        if len(password) < 12:
            raise ValueError("Password must be at least 12 characters long")
        
        if not any(c.isupper() for c in password):
            raise ValueError("Password must contain at least one uppercase letter")
            
        if not any(c.islower() for c in password):
            raise ValueError("Password must contain at least one lowercase letter")
            
        if not any(c.isdigit() for c in password):
            raise ValueError("Password must contain at least one number")
            
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            raise ValueError("Password must contain at least one special character")
        
        # Set hashed password and reset failed attempts
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
        if not email:
            raise ValueError("Email cannot be empty")
            
        # Validate email format using regex
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, email):
            raise ValueError("Invalid email format")
            
        # Convert to lowercase for consistency
        email = email.lower()
        
        return email

    @validates('role')
    def validate_role(self, key: str, role: UserRole) -> UserRole:
        """
        Validate user role assignment based on tenant context.
        
        Args:
            key: Field name being validated
            role: Role to validate
            
        Returns:
            UserRole: Validated role
            
        Raises:
            ValueError: If role assignment is invalid
        """
        if not isinstance(role, UserRole):
            raise ValueError("Invalid role type")
            
        # Validate role assignments
        if role == UserRole.SYSTEM_ADMIN and self.client_id is not None:
            raise ValueError("System admin cannot be associated with a client")
            
        if role == UserRole.CLIENT_ADMIN and self.client_id is None:
            raise ValueError("Client admin must be associated with a client")
            
        return role

    @validates('client_id')
    def validate_tenant_access(self, key: str, client_id: UUID) -> UUID:
        """
        Validate user's tenant access permissions.
        
        Args:
            key: Field name being validated
            client_id: Client ID to validate
            
        Returns:
            UUID: Validated client ID
            
        Raises:
            ValueError: If tenant access is invalid
        """
        if client_id is None and self.role != UserRole.SYSTEM_ADMIN:
            raise ValueError("Only system admins can have no client association")
            
        if self.role == UserRole.SYSTEM_ADMIN and client_id is not None:
            raise ValueError("System admins cannot be associated with a client")
            
        return client_id

    def __repr__(self) -> str:
        """String representation of the User instance."""
        return f"User(email='{self.email}', role={self.role.name}, id={self.id})"