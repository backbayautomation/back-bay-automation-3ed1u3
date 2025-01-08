from datetime import datetime
from uuid import uuid4
import numpy as np
from sqlalchemy import Column, ForeignKey, UUID, ARRAY, Float, DateTime, JSON, Index, String
from sqlalchemy.orm import relationship, validates

from app.db.base import Base
from app.models.chunk import Chunk

# Constants for vector configuration
EMBEDDING_VERSION = '1.0'
VECTOR_DIMENSION = 1536  # As per technical specifications A.1.1

class Embedding(Base):
    """
    SQLAlchemy model representing vector embeddings for document chunks.
    Implements enterprise-grade vector storage with enhanced metadata handling,
    security features, and performance optimizations.
    """
    __tablename__ = 'embeddings'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4,
                doc="Unique identifier for the embedding")
    chunk_id = Column(UUID, ForeignKey('tenant.chunks.id', ondelete='CASCADE'),
                     nullable=False, unique=True, index=True,
                     doc="Reference to parent chunk")

    # Vector Data Fields
    embedding = Column(ARRAY(Float), nullable=False,
                      doc=f"Vector embedding array of dimension {VECTOR_DIMENSION}")
    similarity_score = Column(Float, nullable=False, default=0.0,
                            doc="Similarity score for vector matching")
    metadata = Column(JSON, nullable=False,
                     default={'processing_info': {}, 'vector_params': {}},
                     doc="Embedding metadata and processing information")
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
        {'schema': 'tenant'}
    )

    def __init__(self, chunk_id: UUID, embedding_vector: np.ndarray,
                 similarity_score: float, metadata: dict):
        """
        Initialize embedding with required fields and validation.

        Args:
            chunk_id: UUID of the parent chunk
            embedding_vector: Numpy array of embedding values
            similarity_score: Initial similarity score
            metadata: Additional metadata for the embedding

        Raises:
            ValueError: If validation fails
        """
        # Validate embedding dimensions
        if embedding_vector.shape[0] != VECTOR_DIMENSION:
            raise ValueError(f"Embedding vector must have dimension {VECTOR_DIMENSION}")

        # Validate similarity score
        if not 0 <= similarity_score <= 1:
            raise ValueError("Similarity score must be between 0 and 1")

        self.id = uuid4()
        self.chunk_id = chunk_id
        self.embedding = embedding_vector.tolist()
        self.similarity_score = similarity_score
        
        # Initialize metadata with defaults
        self.metadata = {
            'processing_info': {
                'timestamp': datetime.utcnow().isoformat(),
                'model_version': EMBEDDING_VERSION
            },
            'vector_params': {
                'dimension': VECTOR_DIMENSION,
                'distance_metric': 'cosine'
            },
            **metadata
        }
        
        # Validate metadata
        self.validate_metadata(self.metadata)
        
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
                'processing_info': self.metadata.get('processing_info', {}),
                'vector_params': self.metadata.get('vector_params', {})
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
        if not 0 <= new_score <= 1:
            raise ValueError("Similarity score must be between 0 and 1")
        
        self.similarity_score = new_score
        self.updated_at = datetime.utcnow()

    def get_vector(self) -> np.ndarray:
        """
        Get embedding as numpy array with caching.

        Returns:
            numpy.ndarray: Embedding vector as numpy array
        """
        # Convert embedding list to numpy array
        return np.array(self.embedding, dtype=np.float32)

    @validates('metadata')
    def validate_metadata(self, metadata: dict) -> dict:
        """
        Validate metadata schema and content.

        Args:
            metadata: Metadata dictionary to validate

        Returns:
            dict: Validated metadata dictionary

        Raises:
            ValueError: If validation fails
        """
        if not isinstance(metadata, dict):
            raise ValueError("Metadata must be a dictionary")

        required_keys = {'processing_info', 'vector_params'}
        if not all(key in metadata for key in required_keys):
            raise ValueError(f"Metadata must contain all required keys: {required_keys}")

        # Validate processing info
        if not isinstance(metadata['processing_info'], dict):
            raise ValueError("Processing info must be a dictionary")

        # Validate vector parameters
        if not isinstance(metadata['vector_params'], dict):
            raise ValueError("Vector parameters must be a dictionary")

        # Validate vector dimension
        if metadata['vector_params'].get('dimension') != VECTOR_DIMENSION:
            raise ValueError(f"Vector dimension must be {VECTOR_DIMENSION}")

        return metadata

    def __repr__(self) -> str:
        """String representation of the Embedding instance."""
        return f"<Embedding(id='{self.id}', chunk_id='{self.chunk_id}', similarity_score={self.similarity_score})>"