"""
Pydantic schema models for document chunks used in vector search.
Implements comprehensive validation for document segments that are processed for embeddings and similarity search.
"""

# pydantic v2.0.0
from pydantic import BaseModel, UUID4, Field, ConfigDict
from datetime import datetime
from typing import Optional, Dict, Any

from app.schemas.document import Document

class ChunkBase(BaseModel):
    """Base Pydantic model for chunk data with common attributes and validation."""
    content: str = Field(
        ...,
        min_length=10,
        max_length=8192,
        description="Text content of the document chunk",
        examples=["Technical specifications for pump model A123 include flow rate of 500 GPM"]
    )
    sequence: int = Field(
        ...,
        ge=0,
        le=999999,
        description="Sequential position of chunk in document",
        examples=[1, 42, 156]
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata for the chunk",
        examples=[{
            "page_number": 1,
            "position": 0,
            "confidence": 0.95,
            "section": "Technical Specifications"
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        frozen=True,
        strict=True,
        json_schema_extra={
            "example": {
                "content": "Technical specifications for pump model A123 include flow rate of 500 GPM",
                "sequence": 1,
                "metadata": {
                    "page_number": 1,
                    "position": 0,
                    "confidence": 0.95,
                    "section": "Technical Specifications"
                }
            }
        }
    )

class ChunkCreate(ChunkBase):
    """Pydantic model for creating a new chunk with enhanced validation."""
    document_id: UUID4 = Field(
        ...,
        description="ID of the parent document",
        examples=["123e4567-e89b-12d3-a456-426614174000"]
    )

class ChunkInDB(BaseModel):
    """Pydantic model for chunk data as stored in database with system fields."""
    id: UUID4 = Field(
        ...,
        description="Unique identifier for the chunk"
    )
    document_id: UUID4 = Field(
        ...,
        description="ID of the parent document"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of chunk creation"
    )

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        strict=True
    )

class Chunk(ChunkBase, ChunkInDB):
    """Complete Pydantic model for chunk response data with relationships and embeddings."""
    document: Optional[Document] = Field(
        None,
        description="Parent document details"
    )
    embedding: Optional[Dict[str, Any]] = Field(
        None,
        description="Vector embedding data",
        examples=[{
            "vector": [0.1, 0.2, 0.3],
            "dimension": 1536,
            "model": "text-embedding-ada-002"
        }]
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> "Chunk":
        """Create Chunk schema from ORM model with validation.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Chunk: Validated chunk schema instance
            
        Raises:
            ValueError: If ORM model is invalid or missing required fields
        """
        if not orm_model:
            raise ValueError("Invalid ORM model provided")

        try:
            # Convert ORM model to dictionary with relationships
            data = {
                "id": orm_model.id,
                "document_id": orm_model.document_id,
                "content": orm_model.content,
                "sequence": orm_model.sequence,
                "metadata": orm_model.metadata,
                "created_at": orm_model.created_at,
                "document": orm_model.document if hasattr(orm_model, "document") else None,
                "embedding": orm_model.embedding if hasattr(orm_model, "embedding") else None
            }
            
            # Create and validate Chunk instance
            return cls(**data)
            
        except Exception as e:
            raise ValueError(f"Failed to create Chunk from ORM model: {str(e)}")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "document_id": "987fcdeb-51a2-43f7-9012-345678901234",
                "content": "Technical specifications for pump model A123 include flow rate of 500 GPM",
                "sequence": 1,
                "metadata": {
                    "page_number": 1,
                    "position": 0,
                    "confidence": 0.95,
                    "section": "Technical Specifications"
                },
                "created_at": "2024-01-20T12:00:00Z",
                "document": None,
                "embedding": {
                    "vector": [0.1, 0.2, 0.3],
                    "dimension": 1536,
                    "model": "text-embedding-ada-002"
                }
            }
        }
    )