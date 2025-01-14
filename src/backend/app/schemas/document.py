"""
Pydantic schema models for document data validation and serialization.
Implements comprehensive validation for multi-format document processing with enhanced security and multi-tenant isolation.
"""

# pydantic v2.0.0
from pydantic import BaseModel, UUID4, constr, Field, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict, Any

from app.schemas.client import Client

class DocumentBase(BaseModel):
    """Base Pydantic model for document data with enhanced validation and security controls."""
    filename: constr(min_length=1, max_length=255, pattern='^[a-zA-Z0-9-_. ]+$') = Field(
        ...,
        description="Document filename with allowed characters and extensions",
        examples=["technical_spec.pdf", "product_catalog_2024.xlsx"]
    )
    type: constr(regex='^(pdf|docx?|xlsx?|csv)$') = Field(
        ...,
        description="Supported document file types",
        examples=["pdf", "docx", "xlsx"]
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Document metadata and processing information",
        examples=[{
            "page_count": 42,
            "file_size": "2.5MB",
            "ocr_confidence": 0.95,
            "language": "en"
        }]
    )
    status: constr(regex='^(pending|processing|completed|failed)$') = Field(
        default="pending",
        description="Document processing status",
        examples=["pending", "processing", "completed", "failed"]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        extra="forbid",
        json_schema_extra={
            "example": {
                "filename": "technical_spec.pdf",
                "type": "pdf",
                "metadata": {
                    "page_count": 42,
                    "file_size": "2.5MB",
                    "ocr_confidence": 0.95,
                    "language": "en"
                },
                "status": "pending"
            }
        }
    )

class DocumentCreate(DocumentBase):
    """Pydantic model for creating a new document with strict validation."""
    client_id: UUID4 = Field(
        ...,
        description="Client ID for multi-tenant isolation",
        examples=["123e4567-e89b-12d3-a456-426614174000"]
    )

class DocumentUpdate(BaseModel):
    """Pydantic model for updating an existing document with partial validation."""
    filename: Optional[constr(min_length=1, max_length=255, pattern='^[a-zA-Z0-9-_. ]+$')] = Field(
        None,
        description="Updated document filename"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Updated document metadata"
    )
    status: Optional[constr(regex='^(pending|processing|completed|failed)$')] = Field(
        None,
        description="Updated processing status"
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        extra="forbid",
        json_schema_extra={
            "example": {
                "filename": "updated_spec.pdf",
                "metadata": {
                    "ocr_confidence": 0.98,
                    "processing_time": "45s"
                },
                "status": "completed"
            }
        }
    )

class DocumentInDB(DocumentBase):
    """Pydantic model for document data in database with audit fields."""
    id: UUID4 = Field(
        ...,
        description="Unique document identifier"
    )
    client_id: UUID4 = Field(
        ...,
        description="Associated client identifier"
    )
    created_at: datetime = Field(
        ...,
        description="Document creation timestamp"
    )
    processed_at: Optional[datetime] = Field(
        None,
        description="Document processing completion timestamp"
    )
    updated_at: Optional[datetime] = Field(
        None,
        description="Last update timestamp"
    )
    updated_by: Optional[UUID4] = Field(
        None,
        description="User ID who last updated the document"
    )

class Document(DocumentInDB):
    """Complete Pydantic model for document API responses with relationships."""
    client: Optional[Client] = Field(
        None,
        description="Associated client details"
    )
    chunks: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Processed document chunks with embeddings",
        examples=[[{
            "content": "Technical specifications for pump model A123",
            "page": 1,
            "position": 0,
            "embedding_id": "abc123"
        }]]
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> "Document":
        """Create Document schema from ORM model with relationship handling.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Document: Validated document schema instance
            
        Raises:
            ValueError: If ORM model is invalid or missing required fields
        """
        if not orm_model:
            raise ValueError("Invalid ORM model provided")

        try:
            # Convert ORM model to dictionary with relationships
            data = {
                "id": orm_model.id,
                "client_id": orm_model.client_id,
                "filename": orm_model.filename,
                "type": orm_model.type,
                "metadata": orm_model.metadata,
                "status": orm_model.status,
                "created_at": orm_model.created_at,
                "processed_at": orm_model.processed_at,
                "updated_at": orm_model.updated_at,
                "updated_by": orm_model.updated_by,
                "client": orm_model.client if hasattr(orm_model, "client") else None,
                "chunks": orm_model.chunks if hasattr(orm_model, "chunks") else None
            }
            
            # Create and validate Document instance
            return cls(**data)
            
        except Exception as e:
            raise ValueError(f"Failed to create Document from ORM model: {str(e)}")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "client_id": "987fcdeb-51a2-43f7-9012-345678901234",
                "filename": "technical_spec.pdf",
                "type": "pdf",
                "metadata": {
                    "page_count": 42,
                    "file_size": "2.5MB",
                    "ocr_confidence": 0.95,
                    "language": "en"
                },
                "status": "completed",
                "created_at": "2024-01-20T12:00:00Z",
                "processed_at": "2024-01-20T12:05:00Z",
                "updated_at": "2024-01-20T12:05:00Z",
                "updated_by": "456e789f-g01h-23i4-j567-890123456789",
                "client": None,
                "chunks": []
            }
        }
    )