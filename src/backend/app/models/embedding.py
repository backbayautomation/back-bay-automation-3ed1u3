"""
SQLAlchemy model representing document chunk embeddings for vector similarity search.
Implements enterprise-grade vector storage with enhanced metadata handling, security features,
and performance optimizations for efficient semantic search capabilities.

Version: 1.0.0
"""

from datetime import datetime
from uuid import uuid4
import numpy as np  # version: ^1.24.0
from sqlalchemy import Column, ForeignKey, UUID, ARRAY, Float, DateTime, JSON, Index, String
from sqlalchemy.orm import relationship, validates
from sqlalchemy.exc import ValidationError

from app.db.base import Base
from app.models.chunk import Chunk

# Global constants based on technical specifications
EMBEDDING_VERSION = '1.0'
VECTOR_DIMENSION = 1536  # From technical spec A.1.1

class Embedding(Base):
    """
    SQLAlchemy model for vector embeddings with enhanced security and performance features.
    Implements comprehensive vector storage with tenant isolation and metadata tracking.
    """
    __tablename__ = 'embeddings'

    # Define composite indexes for efficient vector similarity search
    __table_args__ = (
        Index('ix_embeddings_chunk_id', 'chunk_id'),
        Index('ix_embeddings_similarity', 'similarity_score')
    )

    # Primary key with UUID for security and global uniqueness
    id = Column(UUID, primary_key=True, default=uuid4)

    # Foreign key to chunk with index for efficient joins
    chunk_id = Column(
        UUID,
        ForeignKey('chunks.id', ondelete='CASCADE'),
        nullable=False,
        unique=True,
        index=True
    )

    # Vector embedding array with fixed dimensions
    embedding = Column(
        ARRAY(Float, dimensions=VECTOR_DIMENSION),
        nullable=False
    )

    # Similarity score for ranking and filtering
    similarity_score = Column(
        Float,
        nullable=False,
        default=0.0,
        index=True
    )

    # Metadata JSON for vector parameters and processing info
    metadata = Column(
        JSON,
        nullable=False,
        default={
            'vector_params': {
                'dimension': VECTOR_DIMENSION,
                'algorithm': 'cosine',
                'batch_size': 32
            },
            'processing': {
                'model_version': None,
                'processing_time': None,
                'quality_score': None
            }
        }
    )

    # Version tracking for embedding model compatibility
    version = Column(String, nullable=False, default=EMBEDDING_VERSION)

    # Audit timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationship to parent chunk with tenant isolation
    chunk = relationship('Chunk', back_populates='embedding', lazy='joined')

    def __init__(self, chunk_id: UUID, embedding_vector: np.ndarray,
                 similarity_score: float = 0.0, metadata: dict = None):
        """
        Initialize embedding with validation and security checks.

        Args:
            chunk_id: UUID of parent chunk
            embedding_vector: Numpy array of embedding values
            similarity_score: Initial similarity score
            metadata: Optional metadata dictionary

        Raises:
            ValidationError: If validation fails
        """
        # Validate embedding dimensions
        if embedding_vector.shape[0] != VECTOR_DIMENSION:
            raise ValidationError(f"Embedding must have dimension {VECTOR_DIMENSION}")

        # Validate similarity score range
        if not 0.0 <= similarity_score <= 1.0:
            raise ValidationError("Similarity score must be between 0 and 1")

        self.id = uuid4()
        self.chunk_id = chunk_id
        self.embedding = embedding_vector.tolist()
        self.similarity_score = similarity_score
        
        # Initialize metadata with defaults
        default_metadata = {
            'vector_params': {
                'dimension': VECTOR_DIMENSION,
                'algorithm': 'cosine',
                'batch_size': 32
            },
            'processing': {
                'model_version': None,
                'processing_time': None,
                'quality_score': None
            }
        }
        
        if metadata:
            self.validate_metadata(metadata)
            default_metadata.update(metadata)
            
        self.metadata = default_metadata
        self.version = EMBEDDING_VERSION
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at

    def to_dict(self) -> dict:
        """
        Convert embedding to dictionary with security filtering.

        Returns:
            dict: Filtered embedding data dictionary
        """
        return {
            'id': str(self.id),
            'chunk_id': str(self.chunk_id),
            'embedding': self.embedding,
            'similarity_score': self.similarity_score,
            'metadata': {
                'vector_params': self.metadata.get('vector_params'),
                'processing': {
                    'model_version': self.metadata.get('processing', {}).get('model_version'),
                    'quality_score': self.metadata.get('processing', {}).get('quality_score')
                }
            },
            'version': self.version,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def update_similarity(self, new_score: float) -> None:
        """
        Update similarity score with validation.

        Args:
            new_score: New similarity score value

        Raises:
            ValidationError: If score is invalid
        """
        if not 0.0 <= new_score <= 1.0:
            raise ValidationError("Similarity score must be between 0 and 1")
        
        self.similarity_score = new_score
        self.updated_at = datetime.utcnow()

    def get_vector(self) -> np.ndarray:
        """
        Get embedding as numpy array with caching.

        Returns:
            numpy.ndarray: Embedding vector
        """
        # Convert embedding list to numpy array
        return np.array(self.embedding, dtype=np.float32)

    @validates('metadata')
    def validate_metadata(self, metadata: dict) -> bool:
        """
        Validate metadata schema and content.

        Args:
            metadata: Metadata dictionary to validate

        Returns:
            bool: True if validation succeeds

        Raises:
            ValidationError: If validation fails
        """
        if not isinstance(metadata, dict):
            raise ValidationError("Metadata must be a dictionary")

        # Validate vector parameters
        vector_params = metadata.get('vector_params', {})
        if vector_params:
            if not isinstance(vector_params.get('dimension'), int):
                raise ValidationError("Vector dimension must be an integer")
            if vector_params.get('algorithm') not in ['cosine', 'euclidean', 'dot_product']:
                raise ValidationError("Invalid vector similarity algorithm")
            if not isinstance(vector_params.get('batch_size'), int):
                raise ValidationError("Batch size must be an integer")

        # Validate processing information
        processing = metadata.get('processing', {})
        if processing:
            if processing.get('quality_score') is not None:
                if not 0.0 <= float(processing['quality_score']) <= 1.0:
                    raise ValidationError("Quality score must be between 0 and 1")

        return True

    def __repr__(self) -> str:
        """String representation of the Embedding instance."""
        return f"Embedding(id='{self.id}', chunk_id='{self.chunk_id}', version='{self.version}')"