# pydantic v2.0.0
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, UUID4, Field, ConfigDict
import numpy as np

from app.schemas.chunk import ChunkBase, Chunk

class EmbeddingBase(BaseModel):
    """Base Pydantic model for embedding data with strict validation of 1536-dimensional vectors."""
    embedding: List[float] = Field(
        ...,
        description="1536-dimensional vector embedding",
        min_items=1536,
        max_items=1536,
        examples=[[0.1, 0.2, 0.3, "..." * 1533]]
    )
    similarity_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Cosine similarity score",
        examples=[0.95]
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata about the embedding",
        examples=[{
            "model": "text-embedding-ada-002",
            "dimensions": 1536,
            "normalized": True
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "embedding": [0.1, 0.2, 0.3, "..." * 1533],
                "similarity_score": 0.95,
                "metadata": {
                    "model": "text-embedding-ada-002",
                    "dimensions": 1536,
                    "normalized": True
                }
            }
        }
    )

    @classmethod
    def validate_embedding(cls, embedding: List[float]) -> List[float]:
        """Enhanced validation for embedding vector dimensions with error handling.
        
        Args:
            embedding: List of float values representing the embedding vector
            
        Returns:
            List[float]: Validated embedding vector
            
        Raises:
            ValueError: If embedding validation fails
        """
        if not embedding:
            raise ValueError("Embedding vector cannot be None or empty")
            
        if len(embedding) != 1536:
            raise ValueError(f"Embedding must have exactly 1536 dimensions, got {len(embedding)}")
            
        # Validate all values are float and within reasonable range
        for val in embedding:
            if not isinstance(val, float):
                raise ValueError(f"All embedding values must be float type, got {type(val)}")
            if not -1.0 <= val <= 1.0:
                raise ValueError(f"Embedding values must be between -1.0 and 1.0, got {val}")
                
        # Check for NaN or infinite values
        if any(np.isnan(val) or np.isinf(val) for val in embedding):
            raise ValueError("Embedding contains NaN or infinite values")
            
        # Validate vector normalization
        norm = np.linalg.norm(embedding)
        if not 0.99 <= norm <= 1.01:  # Allow small numerical errors
            raise ValueError(f"Embedding vector must be normalized (L2 norm ≈ 1.0), got norm = {norm}")
            
        return embedding

class EmbeddingCreate(EmbeddingBase):
    """Pydantic model for creating a new embedding with enhanced validation."""
    chunk_id: UUID4 = Field(
        ...,
        description="ID of the associated document chunk",
        examples=["123e4567-e89b-12d3-a456-426614174000"]
    )

class EmbeddingInDB(BaseModel):
    """Pydantic model for embedding data as stored in database with timestamps."""
    id: UUID4 = Field(
        ...,
        description="Unique identifier for the embedding"
    )
    chunk_id: UUID4 = Field(
        ...,
        description="ID of the associated document chunk"
    )
    created_at: datetime = Field(
        ...,
        description="Timestamp of embedding creation"
    )

    model_config = ConfigDict(
        from_attributes=True,
        strict=True
    )

class Embedding(EmbeddingInDB, EmbeddingBase):
    """Complete Pydantic model for embedding response data with relationship handling."""
    chunk: Optional[Chunk] = Field(
        None,
        description="Associated document chunk"
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> 'Embedding':
        """Enhanced method to create Embedding schema from ORM model with error handling.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Embedding: Validated Embedding schema instance
            
        Raises:
            ValueError: If ORM model is invalid or conversion fails
        """
        if not orm_model:
            raise ValueError("Invalid ORM model provided")

        try:
            # Convert ORM model to dictionary with relationship handling
            data = {
                "id": orm_model.id,
                "chunk_id": orm_model.chunk_id,
                "embedding": cls.validate_embedding(orm_model.embedding),
                "similarity_score": orm_model.similarity_score,
                "metadata": orm_model.metadata,
                "created_at": orm_model.created_at,
                "chunk": orm_model.chunk if hasattr(orm_model, "chunk") else None
            }
            
            # Create and validate Embedding instance
            return cls(**data)
        except Exception as e:
            raise ValueError(f"Failed to create Embedding from ORM model: {str(e)}")

    def to_vector(self) -> np.ndarray:
        """Optimized conversion of embedding to numpy array with validation.
        
        Returns:
            numpy.ndarray: Embedding as numpy array
            
        Raises:
            ValueError: If conversion fails
        """
        if not self.embedding:
            raise ValueError("Embedding data is missing")
            
        try:
            # Convert to numpy array efficiently
            vector = np.array(self.embedding, dtype=np.float32)
            
            # Verify array shape and type
            if vector.shape != (1536,):
                raise ValueError(f"Invalid vector shape: {vector.shape}")
                
            return vector
        except Exception as e:
            raise ValueError(f"Failed to convert embedding to vector: {str(e)}")

    model_config = ConfigDict(
        from_attributes=True,
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "chunk_id": "987fcdeb-51a2-43f7-9876-543210987654",
                "embedding": [0.1, 0.2, 0.3, "..." * 1533],
                "similarity_score": 0.95,
                "metadata": {
                    "model": "text-embedding-ada-002",
                    "dimensions": 1536,
                    "normalized": True
                },
                "created_at": "2024-01-20T12:00:00Z",
                "chunk": None
            }
        }
    )