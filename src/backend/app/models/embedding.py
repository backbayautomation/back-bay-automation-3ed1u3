"""
SQLAlchemy model representing document chunk embeddings for vector similarity search.
Implements enterprise-grade vector storage with enhanced metadata handling, security features,
and performance optimizations for efficient semantic search capabilities.

Version: 1.0.0
"""

from datetime import datetime
from uuid import uuid4
import numpy as np  # version: ^1.24.0
from sqlalchemy import Column, ForeignKey, UUID, ARRAY, Float, DateTime, JSON, String, Index
from sqlalchemy.orm import relationship, validates
from app.db.base import Base
from app.models.chunk import Chunk

# Constants for vector configuration
EMBEDDING_VERSION = '1.0'
VECTOR_DIMENSION = 1536  # As per technical spec A.1.1

class Embedding(Base):
    """
    SQLAlchemy model for vector embeddings with enhanced security and performance features.
    Implements comprehensive vector storage with tenant isolation and validation.
    """
    __tablename__ = 'embeddings'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4,
               doc="Unique identifier for the embedding")
    chunk_id = Column(UUID, ForeignKey('chunks.id', ondelete='CASCADE'),
                     nullable=False, unique=True, index=True,
                     doc="Reference to parent chunk")

    # Vector and Similarity Fields
    embedding = Column(ARRAY(Float), nullable=False,
                      doc="Vector embedding array")
    similarity_score = Column(Float, nullable=False, default=0.0,
                            doc="Similarity score for ranking")

    # Metadata and Version Fields
    metadata = Column(JSON, nullable=False,
                     doc="Embedding metadata including processing parameters")
    version = Column(String(10), nullable=False, default=EMBEDDING_VERSION,
                    doc="Embedding model version")

    # Audit Fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       doc="Timestamp of embedding creation")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       onupdate=datetime.utcnow,
                       doc="Timestamp of last update")

    # Relationships
    chunk = relationship('Chunk', back_populates='embedding', lazy='joined',
                        doc="Parent chunk relationship")

    # Indexes for query optimization
    __table_args__ = (
        Index('ix_embeddings_similarity', 'similarity_score'),
        {'extend_existing': True}
    )

    def __init__(self, chunk_id: UUID, embedding_vector: np.ndarray,
                 similarity_score: float = 0.0, metadata: dict = None):
        """
        Initialize embedding with required fields and validation.

        Args:
            chunk_id: UUID of parent chunk
            embedding_vector: Numpy array of embedding values
            similarity_score: Initial similarity score
            metadata: Additional metadata for the embedding

        Raises:
            ValueError: If validation fails for any field
        """
        # Validate embedding dimensions
        if embedding_vector.shape[0] != VECTOR_DIMENSION:
            raise ValueError(f"Embedding vector must have dimension {VECTOR_DIMENSION}")

        # Validate similarity score
        if not 0.0 <= similarity_score <= 1.0:
            raise ValueError("Similarity score must be between 0 and 1")

        # Initialize base metadata
        base_metadata = {
            'model_version': EMBEDDING_VERSION,
            'vector_params': {
                'dimension': VECTOR_DIMENSION,
                'algorithm': 'cosine',
                'batch_size': 32
            },
            'processing_stats': {
                'processing_time': 0,
                'confidence_score': similarity_score
            }
        }
        if metadata:
            base_metadata.update(metadata)

        self.id = uuid4()
        self.chunk_id = chunk_id
        self.embedding = embedding_vector.tolist()
        self.similarity_score = similarity_score
        self.metadata = base_metadata
        self.version = EMBEDDING_VERSION
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at

    def to_dict(self) -> dict:
        """
        Convert embedding model to dictionary representation with security filtering.

        Returns:
            dict: Filtered embedding data dictionary
        """
        return {
            'id': str(self.id),
            'chunk_id': str(self.chunk_id),
            'similarity_score': self.similarity_score,
            'metadata': {
                'model_version': self.metadata.get('model_version'),
                'vector_params': self.metadata.get('vector_params'),
                'processing_stats': self.metadata.get('processing_stats')
            },
            'version': self.version,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def update_similarity(self, new_score: float) -> None:
        """
        Update embedding similarity score with validation.

        Args:
            new_score: New similarity score value

        Raises:
            ValueError: If score is invalid
        """
        if not 0.0 <= new_score <= 1.0:
            raise ValueError("Similarity score must be between 0 and 1")

        self.similarity_score = new_score
        self.updated_at = datetime.utcnow()
        self.metadata['processing_stats']['confidence_score'] = new_score

    def get_vector(self) -> np.ndarray:
        """
        Get embedding as numpy array with caching.

        Returns:
            numpy.ndarray: Embedding vector as numpy array
        """
        return np.array(self.embedding, dtype=np.float32)

    @validates('metadata')
    def validate_metadata(self, key: str, metadata: dict) -> dict:
        """
        Validate metadata schema and content.

        Args:
            key: Field name being validated
            metadata: Metadata dictionary to validate

        Returns:
            dict: Validated metadata dictionary

        Raises:
            ValueError: If metadata validation fails
        """
        if not isinstance(metadata, dict):
            raise ValueError("Metadata must be a dictionary")

        required_keys = {'model_version', 'vector_params', 'processing_stats'}
        if not all(key in metadata for key in required_keys):
            raise ValueError(f"Missing required metadata keys: {required_keys}")

        vector_params = metadata.get('vector_params', {})
        required_vector_params = {'dimension', 'algorithm', 'batch_size'}
        if not all(param in vector_params for param in required_vector_params):
            raise ValueError(f"Missing required vector parameters: {required_vector_params}")

        processing_stats = metadata.get('processing_stats', {})
        required_stats = {'processing_time', 'confidence_score'}
        if not all(stat in processing_stats for stat in required_stats):
            raise ValueError(f"Missing required processing stats: {required_stats}")

        return metadata

    def __repr__(self) -> str:
        """String representation of the Embedding instance."""
        return f"<Embedding(id='{self.id}', chunk_id='{self.chunk_id}', similarity={self.similarity_score})>"