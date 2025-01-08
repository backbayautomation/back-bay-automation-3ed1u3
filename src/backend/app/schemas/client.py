# pydantic v2.0.0
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, UUID4, constr, Field, ConfigDict

from app.schemas.organization import Organization

class ClientBase(BaseModel):
    """Base Pydantic model for client data with enhanced validation rules."""
    name: constr(min_length=3, max_length=100, strip_whitespace=True, pattern='^[a-zA-Z0-9\s\-_]+$') = Field(
        ...,
        description="Client name with alphanumeric characters, spaces, hyphens and underscores",
        examples=["Tech Corp", "Client_123", "Enterprise-Solutions"]
    )
    config: dict = Field(
        default_factory=dict,
        description="Client-specific configuration settings",
        examples=[{
            "features_enabled": ["chat", "export"],
            "user_limit": 100,
            "storage_quota": "10GB"
        }]
    )
    branding: dict = Field(
        default_factory=dict,
        description="Client portal branding configuration",
        examples=[{
            "theme": "light",
            "logo_url": "https://example.com/logo.png",
            "primary_color": "#0066CC",
            "secondary_color": "#4CAF50"
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "name": "Tech Solutions Inc",
                "config": {
                    "features_enabled": ["chat", "export"],
                    "user_limit": 100
                },
                "branding": {
                    "theme": "light",
                    "logo_url": "https://example.com/logo.png"
                }
            }
        }
    )

class ClientCreate(ClientBase):
    """Pydantic model for creating a new client with enhanced validation."""
    org_id: UUID4 = Field(
        ...,
        description="Organization ID that owns this client",
        examples=["123e4567-e89b-12d3-a456-426614174000"]
    )

class ClientUpdate(BaseModel):
    """Pydantic model for updating an existing client with partial update support."""
    name: Optional[constr(min_length=3, max_length=100, strip_whitespace=True, pattern='^[a-zA-Z0-9\s\-_]+$')] = Field(
        None,
        description="Updated client name"
    )
    config: Optional[dict] = Field(
        None,
        description="Updated client configuration"
    )
    branding: Optional[dict] = Field(
        None,
        description="Updated client branding"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "name": "Tech Solutions Updated",
                "config": {
                    "features_enabled": ["chat", "export", "analytics"],
                    "user_limit": 150
                }
            }
        }
    )

class ClientInDB(ClientBase):
    """Pydantic model for client data as stored in database with enhanced metadata."""
    id: UUID4 = Field(
        ...,
        description="Unique identifier for the client"
    )
    org_id: UUID4 = Field(
        ...,
        description="Organization ID that owns this client"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of client creation"
    )
    updated_at: datetime = Field(
        ...,
        description="Timestamp of last client update"
    )

    model_config = ConfigDict(
        from_attributes=True,
        strict=True
    )

class Client(ClientInDB):
    """Pydantic model for complete client response data with relationship handling."""
    organization: Optional[Organization] = Field(
        None,
        description="Organization that owns this client"
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> 'Client':
        """Create Client schema from ORM model with enhanced error handling.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Client: Validated Client schema instance
            
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
                "name": orm_model.name,
                "config": orm_model.config,
                "branding": orm_model.branding,
                "created_at": orm_model.created_at,
                "updated_at": orm_model.updated_at,
                "organization": orm_model.organization if hasattr(orm_model, "organization") else None
            }
            
            # Create and validate Client instance
            return cls(**data)
        except Exception as e:
            raise ValueError(f"Failed to create Client from ORM model: {str(e)}")

    model_config = ConfigDict(
        from_attributes=True,
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "org_id": "987fcdeb-51a2-43f7-9876-543210987654",
                "name": "Tech Solutions Inc",
                "config": {
                    "features_enabled": ["chat", "export"],
                    "user_limit": 100
                },
                "branding": {
                    "theme": "light",
                    "logo_url": "https://example.com/logo.png"
                },
                "created_at": "2024-01-20T12:00:00Z",
                "updated_at": "2024-01-20T12:00:00Z",
                "organization": None
            }
        }
    )