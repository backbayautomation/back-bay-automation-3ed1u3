from datetime import datetime
from uuid import uuid4
import json
from sqlalchemy import Column, String, Integer, Text, DateTime, UUID, ForeignKey, JSON, CheckConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.exc import ValidationError

from app.models.document import Document
from app.models.organization import Base

# Constants for validation
MAX_METADATA_SIZE = 524288  # 512KB limit for metadata
METADATA_SCHEMA_VERSION = '1.0'

class Chunk(Base):
    """
    SQLAlchemy model representing a document chunk for vector search with enhanced metadata handling.
    Implements comprehensive chunk management with vector processing capabilities and metadata tracking.
    """
    __tablename__ = 'chunks'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4,
                doc="Unique identifier for the chunk")
    document_id = Column(UUID, ForeignKey('tenant.documents.id', ondelete='CASCADE'),
                        nullable=False, index=True,
                        doc="Reference to parent document")

    # Content Fields
    content = Column(Text, nullable=False,
                    doc="Actual content of the chunk")
    sequence = Column(Integer, nullable=False,
                     doc="Sequence number within document")
    metadata = Column(JSON, nullable=False,
                     default={'schema_version': METADATA_SCHEMA_VERSION,
                             'vector_params': {},
                             'context_info': {}},
                     doc="Chunk processing metadata and vector parameters")

    # Status and Audit Fields
    status = Column(String(50), nullable=False, default='active',
                   doc="Current chunk status")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       doc="Timestamp of chunk creation")
    last_processed_at = Column(DateTime, nullable=True,
                             doc="Timestamp of last processing")

    # Relationships
    document = relationship('Document', back_populates='chunks',
                          doc="Parent document relationship")
    embedding = relationship('Embedding', back_populates='chunk',
                           cascade='all, delete-orphan', uselist=False,
                           doc="Associated vector embedding")

    # Constraints
    status_check = CheckConstraint(
        "status IN ('active', 'processing', 'error', 'deleted')",
        name='ck_chunk_status'
    )

    # Table configuration
    __table_args__ = (
        {'schema': 'tenant'}
    )

    def __init__(self, document_id, content, sequence, metadata=None):
        """
        Initialize chunk with required fields and metadata validation.

        Args:
            document_id (UUID): ID of the parent document
            content (str): Chunk content
            sequence (int): Sequence number
            metadata (dict, optional): Initial metadata

        Raises:
            ValidationError: If validation fails
        """
        self.id = uuid4()
        self.document_id = document_id
        self.content = content
        self.sequence = sequence
        
        # Initialize metadata with defaults and schema version
        self.metadata = {
            'schema_version': METADATA_SCHEMA_VERSION,
            'vector_params': {},
            'context_info': {},
            **(metadata or {})
        }
        
        # Validate metadata
        self.validate_metadata(self.metadata)
        
        self.status = 'active'
        self.created_at = datetime.utcnow()
        self.last_processed_at = None

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
                'context_info': self.metadata.get('context_info', {})
            },
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'last_processed_at': self.last_processed_at.isoformat() if self.last_processed_at else None,
            'embedding': self.embedding.to_dict() if self.embedding else None
        }

    def update_metadata(self, new_metadata):
        """
        Update chunk metadata with validation and schema versioning.

        Args:
            new_metadata (dict): New metadata to merge

        Returns:
            dict: Updated metadata dictionary

        Raises:
            ValidationError: If metadata validation fails
        """
        if not isinstance(new_metadata, dict):
            raise ValidationError("Metadata must be a dictionary")

        # Merge with existing metadata while preserving schema version
        updated_metadata = {
            'schema_version': METADATA_SCHEMA_VERSION,
            'vector_params': self.metadata.get('vector_params', {}),
            'context_info': self.metadata.get('context_info', {}),
            **new_metadata
        }

        # Validate updated metadata
        self.validate_metadata(updated_metadata)

        self.metadata = updated_metadata
        self.last_processed_at = datetime.utcnow()
        return self.metadata

    @validates('metadata')
    def validate_metadata(self, metadata):
        """
        Validate metadata structure and size.

        Args:
            metadata (dict): Metadata to validate

        Returns:
            dict: Validated metadata

        Raises:
            ValidationError: If validation fails
        """
        if not isinstance(metadata, dict):
            raise ValidationError("Metadata must be a dictionary")

        # Check size limit
        if len(json.dumps(metadata)) > MAX_METADATA_SIZE:
            raise ValidationError(f"Metadata size exceeds limit of {MAX_METADATA_SIZE} bytes")

        # Validate required structure
        required_keys = {'schema_version', 'vector_params', 'context_info'}
        if not all(key in metadata for key in required_keys):
            raise ValidationError(f"Metadata must contain all required keys: {required_keys}")

        # Validate schema version
        if metadata['schema_version'] != METADATA_SCHEMA_VERSION:
            raise ValidationError(f"Invalid schema version. Expected {METADATA_SCHEMA_VERSION}")

        # Validate vector parameters
        if not isinstance(metadata['vector_params'], dict):
            raise ValidationError("Vector parameters must be a dictionary")

        # Validate context information
        if not isinstance(metadata['context_info'], dict):
            raise ValidationError("Context information must be a dictionary")

        return metadata

    def __repr__(self):
        """
        String representation of the Chunk instance.

        Returns:
            str: Formatted string with chunk details
        """
        return f"<Chunk(id='{self.id}', document_id='{self.document_id}', sequence={self.sequence}, status='{self.status}')>"