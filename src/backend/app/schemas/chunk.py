# pydantic v2.0.0
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, UUID4, Field, ConfigDict

from app.schemas.document import Document

class ChunkBase(BaseModel):
    """Base Pydantic model for chunk data with common attributes and validation rules."""
    content: str = Field(
        ...,
        min_length=10,
        max_length=8192,
        description="Text content of the document chunk",
        examples=["Technical specifications for the A123 pump model include flow rate of 500 GPM..."]
    )
    sequence: int = Field(
        ...,
        ge=0,
        le=999999,
        description="Sequential position of the chunk within the document",
        examples=[0, 1, 2]
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata about the chunk",
        examples=[{
            "page_number": 1,
            "position": 0,
            "confidence": 0.95,
            "word_count": 150
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        frozen=True,
        strict=True,
        json_schema_extra={
            "example": {
                "content": "Technical specifications for the A123 pump model include flow rate of 500 GPM...",
                "sequence": 0,
                "metadata": {
                    "page_number": 1,
                    "position": 0,
                    "confidence": 0.95,
                    "word_count": 150
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

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "document_id": "123e4567-e89b-12d3-a456-426614174000",
                "content": "Technical specifications for the A123 pump model include flow rate of 500 GPM...",
                "sequence": 0,
                "metadata": {
                    "page_number": 1,
                    "position": 0,
                    "confidence": 0.95,
                    "word_count": 150
                }
            }
        }
    )

class ChunkInDB(ChunkBase):
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
        strict=True
    )

class Chunk(ChunkInDB):
    """Complete Pydantic model for chunk response data with relationships and embeddings."""
    document: Optional[Document] = Field(
        None,
        description="Parent document reference"
    )
    embedding: Optional[Dict[str, Any]] = Field(
        None,
        description="Vector embedding data for similarity search",
        examples=[{
            "vector": [0.1, 0.2, 0.3],
            "dimensions": 1536,
            "model": "text-embedding-ada-002"
        }]
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> 'Chunk':
        """Create Chunk schema from ORM model with relationship handling.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Chunk: Validated Chunk schema instance
            
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
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "document_id": "987fcdeb-51a2-43f7-9876-543210987654",
                "content": "Technical specifications for the A123 pump model include flow rate of 500 GPM...",
                "sequence": 0,
                "metadata": {
                    "page_number": 1,
                    "position": 0,
                    "confidence": 0.95,
                    "word_count": 150
                },
                "created_at": "2024-01-20T12:00:00Z",
                "document": None,
                "embedding": {
                    "vector": [0.1, 0.2, 0.3],
                    "dimensions": 1536,
                    "model": "text-embedding-ada-002"
                }
            }
        }
    )