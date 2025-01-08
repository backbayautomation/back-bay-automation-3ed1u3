# pydantic v2.0.0
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, UUID4, constr, Field, ConfigDict

from app.schemas.client import Client

class DocumentBase(BaseModel):
    """Base Pydantic model for document data with enhanced validation and security controls."""
    filename: constr(min_length=1, max_length=255, pattern='^[a-zA-Z0-9-_. ]+$') = Field(
        ...,
        description="Document filename with allowed characters and extensions",
        examples=["technical_spec.pdf", "product_catalog.xlsx"]
    )
    type: constr(regex='^(pdf|docx?|xlsx?|csv)$') = Field(
        ...,
        description="Document type/format",
        examples=["pdf", "docx", "xlsx"]
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Document metadata and processing information",
        examples=[{
            "page_count": 10,
            "file_size": "1.2MB",
            "ocr_confidence": 0.95,
            "content_type": "technical/specification"
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
                    "page_count": 10,
                    "file_size": "1.2MB",
                    "ocr_confidence": 0.95
                },
                "status": "pending"
            }
        }
    )

class DocumentCreate(DocumentBase):
    """Pydantic model for creating a new document with strict validation."""
    client_id: UUID4 = Field(
        ...,
        description="ID of the client that owns this document",
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
        extra="forbid"
    )

class DocumentInDB(DocumentBase):
    """Pydantic model for document data in database with audit fields."""
    id: UUID4 = Field(
        ...,
        description="Unique identifier for the document"
    )
    client_id: UUID4 = Field(
        ...,
        description="ID of the client that owns this document"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of document creation"
    )
    processed_at: Optional[datetime] = Field(
        None,
        description="Timestamp of document processing completion"
    )
    updated_at: Optional[datetime] = Field(
        None,
        description="Timestamp of last document update"
    )
    updated_by: Optional[UUID4] = Field(
        None,
        description="ID of the user who last updated the document"
    )

    model_config = ConfigDict(
        from_attributes=True,
        strict=True
    )

class Document(DocumentInDB):
    """Complete Pydantic model for document API responses with relationships."""
    client: Optional[Client] = Field(
        None,
        description="Client that owns this document"
    )
    chunks: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Processed document chunks with embeddings",
        examples=[[{
            "content": "Technical specifications for product XYZ",
            "page": 1,
            "position": 0,
            "embedding_id": "123e4567-e89b-12d3-a456-426614174000"
        }]]
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> 'Document':
        """Create Document schema from ORM model with relationship handling.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Document: Validated Document schema instance
            
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
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "client_id": "987fcdeb-51a2-43f7-9876-543210987654",
                "filename": "technical_spec.pdf",
                "type": "pdf",
                "metadata": {
                    "page_count": 10,
                    "file_size": "1.2MB",
                    "ocr_confidence": 0.95
                },
                "status": "completed",
                "created_at": "2024-01-20T12:00:00Z",
                "processed_at": "2024-01-20T12:05:00Z",
                "updated_at": "2024-01-20T12:05:00Z",
                "updated_by": "456e7890-f12d-34e5-a678-901234567890",
                "client": None,
                "chunks": []
            }
        }
    )