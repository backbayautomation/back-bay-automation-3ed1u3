from datetime import datetime
from uuid import uuid4
import json
from sqlalchemy import Column, String, Integer, Text, DateTime, UUID, ForeignKey, JSON, CheckConstraint
from sqlalchemy.orm import relationship, validates
from app.models.document import Document

# Constants for validation and configuration
MAX_METADATA_SIZE = 524288  # 512KB limit for metadata
METADATA_SCHEMA_VERSION = '1.0'

class Chunk(Document.Base):
    """
    SQLAlchemy model representing a document chunk for vector search with enhanced metadata handling.
    Implements comprehensive chunk management for AI-powered document processing and retrieval.
    """
    __tablename__ = 'chunks'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4,
               doc="Unique identifier for the chunk")
    document_id = Column(UUID, ForeignKey('documents.id', ondelete='CASCADE'),
                        nullable=False, index=True,
                        doc="Reference to parent document")

    # Content Fields
    content = Column(Text, nullable=False,
                    doc="Actual content of the document chunk")
    sequence = Column(Integer, nullable=False,
                     doc="Sequence number within the document")
    metadata = Column(JSON, nullable=False, default={
        'schema_version': METADATA_SCHEMA_VERSION,
        'vector_params': {
            'dimension': 1536,
            'algorithm': 'cosine',
            'batch_size': 32
        },
        'processing_stats': {
            'tokens': 0,
            'characters': 0,
            'processing_time': 0
        }
    }, doc="Chunk metadata including vector processing parameters")

    # Audit and Status Fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       doc="Timestamp of chunk creation")
    last_processed_at = Column(DateTime, nullable=True,
                             doc="Timestamp of last processing")
    status = Column(String(50), nullable=False, default='active',
                   doc="Current status of the chunk")

    # Status constraint
    status_check = CheckConstraint(
        "status IN ('active', 'processing', 'error', 'deleted')",
        name='chunk_status_check'
    )

    # Relationships
    document = relationship('Document', back_populates='chunks',
                          doc="Parent document relationship")
    embedding = relationship('Embedding', back_populates='chunk',
                           cascade='all, delete-orphan', uselist=False,
                           doc="Associated vector embedding")

    def __init__(self, document_id, content, sequence, metadata=None):
        """
        Initialize chunk with required fields and metadata validation.

        Args:
            document_id (UUID): Parent document identifier
            content (str): Chunk content
            sequence (int): Sequence number in document
            metadata (dict, optional): Additional metadata for the chunk

        Raises:
            ValidationError: If validation fails for any field
        """
        self.id = uuid4()
        self.document_id = document_id
        self.content = content
        self.sequence = sequence
        
        # Initialize metadata with defaults and provided values
        base_metadata = {
            'schema_version': METADATA_SCHEMA_VERSION,
            'vector_params': {
                'dimension': 1536,
                'algorithm': 'cosine',
                'batch_size': 32
            },
            'processing_stats': {
                'tokens': 0,
                'characters': len(content),
                'processing_time': 0
            }
        }
        if metadata:
            base_metadata.update(metadata)
        
        self.validate_metadata(base_metadata)
        self.metadata = base_metadata
        
        self.created_at = datetime.utcnow()
        self.last_processed_at = None
        self.status = 'active'

    def to_dict(self):
        """
        Convert chunk model to dictionary representation with embedding data.

        Returns:
            dict: Complete chunk data dictionary including embedding information
        """
        return {
            'id': str(self.id),
            'document_id': str(self.document_id),
            'content': self.content,
            'sequence': self.sequence,
            'metadata': {
                'schema_version': self.metadata.get('schema_version'),
                'vector_params': self.metadata.get('vector_params', {}),
                'processing_stats': self.metadata.get('processing_stats', {})
            },
            'created_at': self.created_at.isoformat(),
            'last_processed_at': self.last_processed_at.isoformat() if self.last_processed_at else None,
            'status': self.status,
            'embedding': self.embedding.to_dict() if self.embedding else None
        }

    def update_metadata(self, new_metadata):
        """
        Update chunk metadata with validation and schema versioning.

        Args:
            new_metadata (dict): New metadata to merge with existing

        Returns:
            dict: Updated metadata dictionary

        Raises:
            ValidationError: If metadata validation fails
        """
        # Validate new metadata
        self.validate_metadata(new_metadata)
        
        # Preserve required fields
        preserved_fields = {
            'schema_version': self.metadata.get('schema_version'),
            'vector_params': self.metadata.get('vector_params', {})
        }
        
        # Update metadata and timestamp
        updated_metadata = {**self.metadata, **new_metadata, **preserved_fields}
        self.metadata = updated_metadata
        self.last_processed_at = datetime.utcnow()
        
        return updated_metadata

    @validates('metadata')
    def validate_metadata(self, metadata):
        """
        Validate metadata structure and size.

        Args:
            metadata (dict): Metadata to validate

        Returns:
            bool: Validation result

        Raises:
            ValidationError: If metadata validation fails
        """
        if not isinstance(metadata, dict):
            raise ValueError("Metadata must be a dictionary")

        # Check size limit
        if len(json.dumps(metadata)) > MAX_METADATA_SIZE:
            raise ValueError(f"Metadata size exceeds maximum allowed size of {MAX_METADATA_SIZE} bytes")

        # Validate required fields
        required_fields = {'schema_version', 'vector_params', 'processing_stats'}
        if not all(field in metadata for field in required_fields):
            raise ValueError(f"Missing required metadata fields: {required_fields}")

        # Validate vector parameters
        vector_params = metadata.get('vector_params', {})
        required_vector_params = {'dimension', 'algorithm', 'batch_size'}
        if not all(param in vector_params for param in required_vector_params):
            raise ValueError(f"Missing required vector parameters: {required_vector_params}")

        # Validate processing stats
        processing_stats = metadata.get('processing_stats', {})
        required_stats = {'tokens', 'characters', 'processing_time'}
        if not all(stat in processing_stats for stat in required_stats):
            raise ValueError(f"Missing required processing stats: {required_stats}")

        return metadata

    def __repr__(self):
        """
        String representation of the Chunk instance.

        Returns:
            str: Formatted string with chunk details
        """
        return f"<Chunk(id='{self.id}', sequence={self.sequence}, status='{self.status}')>"