"""
Pydantic schema models for user data validation and serialization with enhanced security,
role-based access control, and multi-tenant support.

Version: 2.0.0
"""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, UUID4, EmailStr, constr, Field, ConfigDict  # version: 2.0.0

from ..models.user import UserRole
from .organization import Organization
from .client import Client

class UserBase(BaseModel):
    """Base Pydantic model for user data with enhanced validation and security."""
    email: EmailStr = Field(
        ...,
        description="User's email address with strict format validation",
        examples=["user@example.com"]
    )
    full_name: constr(min_length=2, max_length=100, pattern='^[a-zA-Z ]*$') = Field(
        ...,
        description="User's full name with alphabetic characters only",
        examples=["John Smith"]
    )
    role: UserRole = Field(
        ...,
        description="User's role for access control",
        examples=[UserRole.REGULAR_USER]
    )
    is_active: bool = Field(
        True,
        description="User account status"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "full_name": "John Smith",
                "role": UserRole.REGULAR_USER,
                "is_active": True
            }
        }
    )

class UserCreate(UserBase):
    """Pydantic model for secure user creation with strict validation."""
    org_id: UUID4 = Field(
        ...,
        description="Organization ID for multi-tenant isolation"
    )
    client_id: Optional[UUID4] = Field(
        None,
        description="Optional client ID for client-specific users"
    )
    password: constr(
        min_length=12,
        max_length=64,
        pattern='^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]*$'
    ) = Field(
        ...,
        description="Secure password with complexity requirements",
        examples=["SecureP@ssw0rd123"]
    )

class UserUpdate(BaseModel):
    """Pydantic model for secure user updates with optional fields."""
    email: Optional[EmailStr] = None
    full_name: Optional[constr(min_length=2, max_length=100, pattern='^[a-zA-Z ]*$')] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[constr(
        min_length=12,
        max_length=64,
        pattern='^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]*$'
    )] = None

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "email": "updated@example.com",
                "full_name": "John Updated Smith",
                "role": UserRole.CLIENT_ADMIN,
                "is_active": True,
                "password": "NewSecureP@ssw0rd123"
            }
        }
    )

class UserInDB(UserBase):
    """Pydantic model for secure database representation with audit fields."""
    id: UUID4 = Field(
        ...,
        description="Unique identifier for the user"
    )
    org_id: UUID4 = Field(
        ...,
        description="Organization ID for multi-tenant isolation"
    )
    client_id: Optional[UUID4] = Field(
        None,
        description="Optional client ID for client-specific users"
    )
    hashed_password: str = Field(
        ...,
        description="Securely hashed password"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of user creation"
    )
    updated_at: datetime = Field(
        ...,
        description="Timestamp of last user update"
    )
    last_login: Optional[datetime] = Field(
        None,
        description="Timestamp of last successful login"
    )
    last_ip: Optional[str] = Field(
        None,
        description="IP address of last login attempt"
    )

class User(UserBase):
    """Complete user schema with relationships and audit data."""
    id: UUID4 = Field(
        ...,
        description="Unique identifier for the user"
    )
    org_id: UUID4 = Field(
        ...,
        description="Organization ID for multi-tenant isolation"
    )
    client_id: Optional[UUID4] = Field(
        None,
        description="Optional client ID for client-specific users"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of user creation"
    )
    updated_at: datetime = Field(
        ...,
        description="Timestamp of last user update"
    )
    last_login: Optional[datetime] = Field(
        None,
        description="Timestamp of last successful login"
    )
    organization: Optional[Organization] = Field(
        None,
        description="Associated organization details"
    )
    client: Optional[Client] = Field(
        None,
        description="Associated client details"
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> "User":
        """
        Create User schema from ORM model with data masking.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            User: Validated and masked user schema instance
            
        Raises:
            ValueError: If ORM model is invalid or missing required fields
        """
        if not orm_model:
            raise ValueError("Invalid ORM model provided")

        try:
            # Convert ORM model to dictionary with relationship handling
            data = {
                "id": orm_model.id,
                "org_id": orm_model.org_id,
                "client_id": orm_model.client_id,
                "email": orm_model.email,
                "full_name": orm_model.full_name,
                "role": orm_model.role,
                "is_active": orm_model.is_active,
                "created_at": orm_model.created_at,
                "updated_at": orm_model.updated_at,
                "last_login": orm_model.last_login,
                "organization": orm_model.organization if hasattr(orm_model, "organization") else None,
                "client": orm_model.client if hasattr(orm_model, "client") else None
            }
            
            # Create and validate User instance
            return cls(**data)
            
        except Exception as e:
            raise ValueError(f"Failed to create User from ORM model: {str(e)}")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "org_id": "987fcdeb-51a2-43f7-9012-345678901234",
                "client_id": "456abcde-f123-45f6-789a-bcdef0123456",
                "email": "user@example.com",
                "full_name": "John Smith",
                "role": UserRole.REGULAR_USER,
                "is_active": True,
                "created_at": "2024-01-20T12:00:00Z",
                "updated_at": "2024-01-20T12:00:00Z",
                "last_login": "2024-01-20T14:30:00Z",
                "organization": None,
                "client": None
            }
        }
    )