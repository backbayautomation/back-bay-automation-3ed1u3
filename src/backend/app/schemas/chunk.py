"""
Pydantic schema models for document chunks used in vector search.
Implements comprehensive validation for document segments that are processed for embeddings and similarity search.
"""

# pydantic v2.0.0
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, UUID4, Field, ConfigDict

from app.schemas.document import Document

class ChunkBase(BaseModel):
    """Base Pydantic model for chunk data with common attributes and validation."""
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
        examples=[1, 2, 3]
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata for the chunk",
        examples=[{
            "page": 1,
            "position": 0,
            "section": "Technical Specifications",
            "confidence": 0.95
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        frozen=True,
        strict=True,
        json_schema_extra={
            "example": {
                "content": "Technical specifications for the A123 pump model include flow rate of 500 GPM...",
                "sequence": 1,
                "metadata": {
                    "page": 1,
                    "position": 0,
                    "section": "Technical Specifications",
                    "confidence": 0.95
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

    @classmethod
    def validate_metadata(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Validate metadata structure and content."""
        required_keys = {"page", "position"}
        if not all(key in v for key in required_keys):
            raise ValueError(f"Metadata must contain keys: {required_keys}")
        if not isinstance(v.get("page"), int) or not isinstance(v.get("position"), int):
            raise ValueError("page and position must be integers")
        if "confidence" in v and not (0 <= float(v["confidence"]) <= 1):
            raise ValueError("confidence must be between 0 and 1")
        return v

class ChunkInDB(ChunkBase):
    """Pydantic model for chunk data as stored in database."""
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
    """Complete Pydantic model for chunk response data with enhanced validation."""
    document: Optional[Document] = Field(
        None,
        description="Parent document reference"
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
    def validate_embedding(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Validate embedding vector format and dimensions."""
        if v is None:
            return v
        if "vector" not in v or "dimension" not in v:
            raise ValueError("Embedding must contain vector and dimension")
        if not isinstance(v["vector"], list):
            raise ValueError("Embedding vector must be a list")
        if len(v["vector"]) != v["dimension"]:
            raise ValueError("Vector length must match specified dimension")
        return v

    @classmethod
    def from_orm(cls, orm_model: Any) -> 'Chunk':
        """Create Chunk schema from ORM model with validation.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Chunk: Validated Chunk schema instance
            
        Raises:
            ValueError: If invalid or missing required fields
            TypeError: If invalid ORM model type
        """
        if not hasattr(orm_model, '__table__'):
            raise TypeError("Invalid ORM model provided")

        try:
            # Convert ORM model to dictionary with relationships
            data = {
                'id': orm_model.id,
                'document_id': orm_model.document_id,
                'content': orm_model.content,
                'sequence': orm_model.sequence,
                'metadata': orm_model.metadata,
                'created_at': orm_model.created_at,
                'document': orm_model.document if hasattr(orm_model, 'document') else None,
                'embedding': orm_model.embedding if hasattr(orm_model, 'embedding') else None
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
                "document_id": "987fcdeb-51a2-43f7-9012-345678901234",
                "content": "Technical specifications for the A123 pump model include flow rate of 500 GPM...",
                "sequence": 1,
                "metadata": {
                    "page": 1,
                    "position": 0,
                    "section": "Technical Specifications",
                    "confidence": 0.95
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