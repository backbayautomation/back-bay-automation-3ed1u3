from datetime import datetime
from uuid import uuid4
import json
from sqlalchemy import Column, String, Integer, Text, DateTime, UUID, ForeignKey, JSON, CheckConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.exc import ValidationError

# Import Document model for relationship
from app.models.document import Document

# Global constants for validation
MAX_METADATA_SIZE = 524288  # 512KB limit for metadata
METADATA_SCHEMA_VERSION = '1.0'

class Chunk:
    """
    SQLAlchemy model representing a document chunk for vector search with enhanced metadata handling.
    Implements comprehensive chunk management for AI-powered document processing and retrieval.
    """
    __tablename__ = 'chunks'

    # Primary key with UUID for security and global uniqueness
    id = Column(UUID, primary_key=True, default=uuid4)
    
    # Document foreign key with index for efficient querying
    document_id = Column(
        UUID,
        ForeignKey('documents.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    
    # Chunk content and sequence
    content = Column(Text, nullable=False)
    sequence = Column(Integer, nullable=False)
    
    # Metadata JSON with schema version and vector processing parameters
    metadata = Column(
        JSON,
        nullable=False,
        default={
            'schema_version': METADATA_SCHEMA_VERSION,
            'vector_params': {
                'dimension': 1536,
                'algorithm': 'cosine',
                'batch_size': 32
            },
            'context': {
                'prev_chunk_id': None,
                'next_chunk_id': None,
                'context_window': 8192
            }
        }
    )
    
    # Audit timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_processed_at = Column(DateTime, nullable=True)
    
    # Status tracking with constraint
    status = Column(String(50), nullable=False, default='active')
    status_check = CheckConstraint("status IN ('active', 'processing', 'error', 'deleted')")
    
    # Relationships
    document = relationship('Document', back_populates='chunks')
    embedding = relationship(
        'Embedding',
        back_populates='chunk',
        cascade='all, delete-orphan',
        uselist=False
    )

    def __init__(self, document_id, content, sequence, metadata=None):
        """
        Initialize chunk with required fields and metadata validation.
        
        Args:
            document_id (UUID): ID of the parent document
            content (str): Chunk text content
            sequence (int): Sequence number in document
            metadata (dict, optional): Initial metadata
            
        Raises:
            ValidationError: If validation fails
        """
        self.id = uuid4()
        self.document_id = document_id
        self.content = content
        self.sequence = sequence
        
        # Initialize metadata with defaults and validate
        default_metadata = {
            'schema_version': METADATA_SCHEMA_VERSION,
            'vector_params': {
                'dimension': 1536,
                'algorithm': 'cosine',
                'batch_size': 32
            },
            'context': {
                'prev_chunk_id': None,
                'next_chunk_id': None,
                'context_window': 8192
            }
        }
        
        if metadata:
            self.validate_metadata(metadata)
            default_metadata.update(metadata)
        
        self.metadata = default_metadata
        self.created_at = datetime.utcnow()
        self.status = 'active'
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
                'vector_params': self.metadata.get('vector_params'),
                'context': self.metadata.get('context')
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
            new_metadata (dict): New metadata to merge
            
        Returns:
            dict: Updated metadata dictionary
            
        Raises:
            ValidationError: If metadata validation fails
        """
        # Validate new metadata
        self.validate_metadata(new_metadata)
        
        # Preserve required fields
        preserved_fields = {
            'schema_version': self.metadata.get('schema_version', METADATA_SCHEMA_VERSION)
        }
        
        # Update metadata
        updated_metadata = {
            **self.metadata,
            **new_metadata,
            **preserved_fields
        }
        
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
            bool: Validation result
            
        Raises:
            ValidationError: If validation fails
        """
        # Check size limit
        if len(json.dumps(metadata)) > MAX_METADATA_SIZE:
            raise ValidationError(f"Metadata size exceeds limit of {MAX_METADATA_SIZE} bytes")
        
        # Validate required structure
        if not isinstance(metadata, dict):
            raise ValidationError("Metadata must be a dictionary")
        
        # Validate vector parameters if present
        vector_params = metadata.get('vector_params', {})
        if vector_params:
            if not isinstance(vector_params.get('dimension'), int):
                raise ValidationError("Vector dimension must be an integer")
            if not isinstance(vector_params.get('batch_size'), int):
                raise ValidationError("Batch size must be an integer")
            if vector_params.get('algorithm') not in ['cosine', 'euclidean', 'dot_product']:
                raise ValidationError("Invalid vector similarity algorithm")
        
        # Validate context if present
        context = metadata.get('context', {})
        if context:
            if not isinstance(context.get('context_window'), int):
                raise ValidationError("Context window must be an integer")
            
        return True

    def __repr__(self):
        """
        String representation of the Chunk instance.
        
        Returns:
            str: Formatted string with chunk details
        """
        return f"Chunk(id='{self.id}', document_id='{self.document_id}', sequence={self.sequence}, status='{self.status}')"