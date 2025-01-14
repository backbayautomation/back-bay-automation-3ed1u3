"""
Organization schema models for multi-tenant data validation and serialization.
Implements comprehensive validation rules and ORM integration for organization management.
"""

# pydantic v2.0.0
from pydantic import BaseModel, UUID4, constr, Field, ConfigDict
from datetime import datetime
from typing import Optional, List, Any

class OrganizationBase(BaseModel):
    """Base Pydantic model for organization data with common attributes and validation rules."""
    name: constr(min_length=3, max_length=100, pattern='^[a-zA-Z0-9-_ ]+$') = Field(
        ...,
        description="Organization name with alphanumeric characters, spaces, hyphens and underscores",
        examples=["Acme Corp", "Tech_Solutions_123"]
    )
    settings: dict = Field(
        default_factory=dict,
        description="Organization-specific configuration and settings",
        examples=[{
            "theme": "light",
            "language": "en",
            "features": ["chat", "export"],
            "retention_days": 30
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        frozen=True,
        json_schema_extra={
            "example": {
                "name": "Acme Corporation",
                "settings": {
                    "theme": "light",
                    "language": "en",
                    "features": ["chat", "export"]
                }
            }
        }
    )

class OrganizationCreate(OrganizationBase):
    """Pydantic model for creating a new organization with required fields."""
    pass

class OrganizationUpdate(BaseModel):
    """Pydantic model for updating an existing organization with optional fields."""
    name: Optional[constr(min_length=3, max_length=100, pattern='^[a-zA-Z0-9-_ ]+$')] = Field(
        None,
        description="Updated organization name"
    )
    settings: Optional[dict] = Field(
        None,
        description="Updated organization settings"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "name": "Acme Corp Updated",
                "settings": {
                    "theme": "dark",
                    "features": ["chat", "export", "analytics"]
                }
            }
        }
    )

class OrganizationInDB(OrganizationBase):
    """Pydantic model for organization data as stored in database with system fields."""
    id: UUID4 = Field(
        ...,
        description="Unique identifier for the organization"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of organization creation"
    )
    updated_at: datetime = Field(
        ...,
        description="Timestamp of last organization update"
    )

class Organization(OrganizationInDB):
    """Complete Pydantic model for organization response data with relationships."""
    clients: Optional[List["Client"]] = Field(
        None,
        description="List of clients associated with this organization"
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> "Organization":
        """Create Organization schema from ORM model with error handling.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Organization: Validated organization schema instance
            
        Raises:
            ValueError: If ORM model is invalid or missing required fields
        """
        if not orm_model:
            raise ValueError("Invalid ORM model provided")

        try:
            # Convert ORM model to dictionary with relationship handling
            data = {
                "id": orm_model.id,
                "name": orm_model.name,
                "settings": orm_model.settings,
                "created_at": orm_model.created_at,
                "updated_at": orm_model.updated_at,
                "clients": orm_model.clients if hasattr(orm_model, "clients") else None
            }
            
            # Create and validate Organization instance
            return cls(**data)
            
        except Exception as e:
            raise ValueError(f"Failed to create Organization from ORM model: {str(e)}")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Acme Corporation",
                "settings": {
                    "theme": "light",
                    "language": "en",
                    "features": ["chat", "export"]
                },
                "created_at": "2024-01-20T12:00:00Z",
                "updated_at": "2024-01-20T12:00:00Z",
                "clients": []
            }
        }
    )