"""
Pydantic schema models for vector embeddings used in semantic search functionality.
Implements strict validation for 1536-dimensional vectors with cosine similarity support,
relationship handling with document chunks, and efficient numpy array conversions.
"""

# pydantic v2.0.0
from pydantic import BaseModel, UUID4, Field, ConfigDict
from datetime import datetime
from typing import List, Optional, Dict, Any
import numpy as np  # numpy ^1.24.0

from app.schemas.chunk import ChunkBase, Chunk

class EmbeddingBase(BaseModel):
    """Base Pydantic model for embedding data with strict validation of 1536-dimensional vectors."""
    embedding: List[float] = Field(
        ...,
        description="1536-dimensional vector embedding",
        min_items=1536,
        max_items=1536
    )
    similarity_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Cosine similarity score",
        examples=[0.95, 0.87, 0.75]
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata for the embedding",
        examples=[{
            "model": "text-embedding-ada-002",
            "dimension": 1536,
            "processing_time": "0.15s"
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "embedding": [0.1] * 1536,
                "similarity_score": 0.95,
                "metadata": {
                    "model": "text-embedding-ada-002",
                    "dimension": 1536,
                    "processing_time": "0.15s"
                }
            }
        },
        validation_alias_generator=lambda field_name: field_name,
        strict=True
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
            raise ValueError(f"Embedding must be 1536-dimensional, got {len(embedding)}")
            
        if not all(isinstance(x, (int, float)) for x in embedding):
            raise ValueError("All embedding values must be numeric")
            
        # Convert to numpy array for validation
        embedding_array = np.array(embedding, dtype=np.float32)
        
        if np.any(np.isnan(embedding_array)) or np.any(np.isinf(embedding_array)):
            raise ValueError("Embedding contains NaN or infinite values")
            
        # Validate vector normalization
        norm = np.linalg.norm(embedding_array)
        if not np.isclose(norm, 1.0, rtol=1e-5):
            raise ValueError(f"Embedding vector must be normalized, got norm={norm}")
            
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

class Embedding(EmbeddingBase, EmbeddingInDB):
    """Complete Pydantic model for embedding response data with relationship handling."""
    chunk: Optional[Chunk] = Field(
        None,
        description="Associated document chunk details"
    )

    @classmethod
    def from_orm(cls, orm_model: Any) -> "Embedding":
        """Enhanced method to create Embedding schema from ORM model with error handling.
        
        Args:
            orm_model: SQLAlchemy ORM model instance
            
        Returns:
            Embedding: Validated Embedding schema instance
            
        Raises:
            ValueError: If ORM model conversion fails
        """
        if not orm_model:
            raise ValueError("Invalid ORM model provided")

        try:
            # Handle numpy array conversion if present
            embedding_data = orm_model.embedding
            if isinstance(embedding_data, np.ndarray):
                embedding_data = embedding_data.tolist()

            # Convert ORM model to dictionary with relationships
            data = {
                "id": orm_model.id,
                "chunk_id": orm_model.chunk_id,
                "embedding": embedding_data,
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
        try:
            # Validate embedding data
            if not self.embedding:
                raise ValueError("Embedding data is missing")
                
            # Convert to numpy array efficiently
            vector = np.array(self.embedding, dtype=np.float32)
            
            # Verify array shape
            if vector.shape != (1536,):
                raise ValueError(f"Invalid vector shape: {vector.shape}")
                
            return vector
            
        except Exception as e:
            raise ValueError(f"Failed to convert embedding to vector: {str(e)}")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        strict=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "chunk_id": "987fcdeb-51a2-43f7-9012-345678901234",
                "embedding": [0.1] * 1536,
                "similarity_score": 0.95,
                "metadata": {
                    "model": "text-embedding-ada-002",
                    "dimension": 1536,
                    "processing_time": "0.15s"
                },
                "created_at": "2024-01-20T12:00:00Z",
                "chunk": None
            }
        }
    )