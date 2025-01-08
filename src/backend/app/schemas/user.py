"""
Pydantic schema models for user data validation and serialization with enhanced security,
role-based access control, and multi-tenant support.

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, UUID4, EmailStr, constr, Field, ConfigDict

from ..models.user import UserRole
from .organization import Organization
from .client import Client

class UserBase(BaseModel):
    """Base Pydantic model for user data with enhanced validation and security."""
    email: EmailStr = Field(
        ...,
        description="User's email address for authentication",
        examples=["user@example.com"]
    )
    full_name: constr(min_length=2, max_length=100, pattern='^[a-zA-Z ]*$') = Field(
        ...,
        description="User's full name (letters and spaces only)",
        examples=["John Smith"]
    )
    role: UserRole = Field(
        ...,
        description="User's role for access control",
        examples=[UserRole.REGULAR_USER]
    )
    is_active: bool = Field(
        default=True,
        description="User account status"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "full_name": "John Smith",
                "role": UserRole.REGULAR_USER.value,
                "is_active": True
            }
        }
    )

class UserCreate(UserBase):
    """Pydantic model for secure user creation with strict validation."""
    org_id: UUID4 = Field(
        ...,
        description="Organization ID for tenant isolation",
        examples=["123e4567-e89b-12d3-a456-426614174000"]
    )
    client_id: Optional[UUID4] = Field(
        None,
        description="Client ID for client-specific users",
        examples=["987fcdeb-51a2-43f7-9012-345678901234"]
    )
    password: constr(min_length=12, max_length=64, pattern='^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]*$') = Field(
        ...,
        description="Strong password with minimum requirements",
        examples=["SecureP@ssw0rd123"]
    )

class UserUpdate(BaseModel):
    """Pydantic model for secure user updates with optional fields."""
    email: Optional[EmailStr] = Field(
        None,
        description="Updated email address"
    )
    full_name: Optional[constr(min_length=2, max_length=100, pattern='^[a-zA-Z ]*$')] = Field(
        None,
        description="Updated full name"
    )
    role: Optional[UserRole] = Field(
        None,
        description="Updated user role"
    )
    is_active: Optional[bool] = Field(
        None,
        description="Updated account status"
    )
    password: Optional[constr(min_length=12, max_length=64, pattern='^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]*$')] = Field(
        None,
        description="Updated password"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "email": "updated@example.com",
                "full_name": "John Updated Smith",
                "role": UserRole.CLIENT_ADMIN.value,
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
        description="Organization ID for tenant isolation"
    )
    client_id: Optional[UUID4] = Field(
        None,
        description="Client ID for client-specific users"
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
        description="Last IP address used for login",
        max_length=45
    )

    model_config = ConfigDict(
        from_attributes=True,
        strict=True
    )

class User(UserInDB):
    """Complete user schema with relationships and audit data."""
    organization: Optional[Organization] = Field(
        None,
        description="Parent organization relationship"
    )
    client: Optional[Client] = Field(
        None,
        description="Associated client relationship"
    )

    @classmethod
    def from_orm(cls, orm_model) -> 'User':
        """
        Create User schema from ORM model with data masking.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            User: Validated User schema instance with masked sensitive data
            
        Raises:
            ValueError: If invalid or missing required fields
            TypeError: If invalid ORM model type
        """
        if not hasattr(orm_model, '__table__'):
            raise TypeError("Invalid ORM model provided")

        try:
            # Convert ORM model to dictionary with masked sensitive data
            data = {
                'id': orm_model.id,
                'org_id': orm_model.org_id,
                'client_id': orm_model.client_id,
                'email': orm_model.email,
                'full_name': orm_model.full_name,
                'role': orm_model.role,
                'is_active': orm_model.is_active,
                'hashed_password': '******',  # Mask password
                'created_at': orm_model.created_at,
                'updated_at': orm_model.updated_at,
                'last_login': orm_model.last_login,
                'last_ip': orm_model.last_ip_address if hasattr(orm_model, 'last_ip_address') else None,
                'organization': orm_model.organization if hasattr(orm_model, 'organization') else None,
                'client': orm_model.client if hasattr(orm_model, 'client') else None
            }
            
            # Create and validate User instance
            return cls(**data)
            
        except Exception as e:
            raise ValueError(f"Failed to create User from ORM model: {str(e)}")

    model_config = ConfigDict(
        from_attributes=True,
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "org_id": "987fcdeb-51a2-43f7-9012-345678901234",
                "client_id": "abcdef12-3456-7890-abcd-ef1234567890",
                "email": "user@example.com",
                "full_name": "John Smith",
                "role": UserRole.REGULAR_USER.value,
                "is_active": True,
                "hashed_password": "******",
                "created_at": "2024-01-20T12:00:00Z",
                "updated_at": "2024-01-20T12:00:00Z",
                "last_login": "2024-01-20T14:30:00Z",
                "last_ip": "192.168.1.1",
                "organization": None,
                "client": None
            }
        }
    )