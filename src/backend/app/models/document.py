from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, UUID, JSON, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship, validates
from sqlalchemy.exc import ValidationError

from app.models.client import Client
from app.models.organization import Base

# Constants for validation
VALID_STATUSES = ['pending', 'processing', 'completed', 'failed']
VALID_TYPES = ['pdf', 'docx', 'xlsx']
MAX_METADATA_SIZE = 1048576  # 1MB limit for metadata JSON

class Document(Base):
    """
    SQLAlchemy model representing a document with enhanced security and validation.
    Implements comprehensive document management with multi-tenant isolation,
    processing status tracking, and audit capabilities.
    """
    __tablename__ = 'documents'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4,
                doc="Unique identifier for the document")
    client_id = Column(UUID, ForeignKey('tenant.clients.id', ondelete='CASCADE'),
                      nullable=False, index=True,
                      doc="Client ID for tenant isolation")
    
    # Document Fields
    filename = Column(String(255), nullable=False,
                     doc="Original filename of the document")
    type = Column(String(50), nullable=False,
                 doc="Document type (pdf, docx, xlsx)")
    metadata = Column(JSON, nullable=False,
                     default={'status_history': [], 'schema_version': '1.0'},
                     doc="Document metadata including processing history")
    status = Column(String(20), nullable=False, default='pending',
                   doc="Current processing status")
    
    # Audit Fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       doc="Timestamp of document creation")
    processed_at = Column(DateTime, nullable=True,
                         doc="Timestamp of successful processing completion")
    last_modified = Column(DateTime, nullable=False, default=datetime.utcnow,
                          doc="Timestamp of last modification")
    retry_count = Column(Integer, nullable=False, default=0,
                        doc="Number of processing retry attempts")

    # Relationships
    client = relationship('Client', back_populates='documents',
                         doc="Parent client relationship")
    chunks = relationship('Chunk', back_populates='document',
                         cascade='all, delete-orphan',
                         doc="Document chunks for processing")

    # Indexes for query optimization
    __table_args__ = (
        Index('ix_documents_client_status', 'client_id', 'status'),
        Index('ix_documents_type_created', 'type', 'created_at'),
        {'schema': 'tenant'}
    )

    def __init__(self, client_id, filename, type, metadata=None):
        """
        Initialize document with required fields and validation.

        Args:
            client_id (UUID): ID of the owning client
            filename (str): Original filename
            type (str): Document type (pdf, docx, xlsx)
            metadata (dict, optional): Initial metadata

        Raises:
            ValidationError: If validation fails
        """
        self.id = uuid4()
        self.client_id = client_id
        self.filename = filename
        self.validate_type(type)
        self.type = type
        
        # Initialize metadata with defaults
        self.metadata = {
            'status_history': [],
            'schema_version': '1.0',
            **(metadata or {})
        }
        
        # Validate metadata size
        if len(str(self.metadata)) > MAX_METADATA_SIZE:
            raise ValidationError("Metadata size exceeds maximum limit")
        
        self.status = 'pending'
        self.created_at = datetime.utcnow()
        self.last_modified = self.created_at
        self.processed_at = None
        self.retry_count = 0

    def to_dict(self):
        """
        Convert document model to dictionary with sensitive data handling.

        Returns:
            dict: Document data dictionary with masked sensitive information
        """
        return {
            'id': str(self.id),
            'client_id': str(self.client_id),
            'filename': self.filename,
            'type': self.type,
            'status': self.status,
            'metadata': {
                'schema_version': self.metadata.get('schema_version'),
                'status_history': self.metadata.get('status_history', []),
                # Exclude potentially sensitive metadata
                **{k: v for k, v in self.metadata.items() 
                   if k not in ['schema_version', 'status_history', 'sensitive_data']}
            },
            'created_at': self.created_at.isoformat(),
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'last_modified': self.last_modified.isoformat(),
            'retry_count': self.retry_count,
            'chunk_count': len(self.chunks) if self.chunks else 0
        }

    def update_status(self, new_status):
        """
        Update document processing status with validation and history.

        Args:
            new_status (str): New status to set

        Raises:
            ValidationError: If status is invalid or transition is not allowed
        """
        if new_status not in VALID_STATUSES:
            raise ValidationError(f"Invalid status: {new_status}")

        # Validate status transitions
        invalid_transitions = {
            'completed': ['processing', 'pending'],
            'failed': ['completed']
        }
        if new_status in invalid_transitions.get(self.status, []):
            raise ValidationError(f"Invalid status transition from {self.status} to {new_status}")

        # Update status and history
        old_status = self.status
        self.status = new_status
        self.metadata['status_history'].append({
            'from': old_status,
            'to': new_status,
            'timestamp': datetime.utcnow().isoformat(),
            'retry_count': self.retry_count
        })

        # Update related fields
        self.last_modified = datetime.utcnow()
        if new_status == 'completed':
            self.processed_at = self.last_modified
        elif new_status == 'failed':
            self.retry_count += 1

    def update_metadata(self, new_metadata):
        """
        Update document metadata with validation and size checks.

        Args:
            new_metadata (dict): New metadata to merge

        Raises:
            ValidationError: If metadata validation fails
        """
        if not isinstance(new_metadata, dict):
            raise ValidationError("Metadata must be a dictionary")

        # Preserve required fields
        updated_metadata = {
            'status_history': self.metadata.get('status_history', []),
            'schema_version': self.metadata.get('schema_version', '1.0'),
            **new_metadata
        }

        # Validate size
        if len(str(updated_metadata)) > MAX_METADATA_SIZE:
            raise ValidationError("Updated metadata size exceeds maximum limit")

        self.metadata = updated_metadata
        self.last_modified = datetime.utcnow()

    @validates('type')
    def validate_type(self, type):
        """
        Validate document type is supported.

        Args:
            type (str): Document type to validate

        Returns:
            str: Validated document type

        Raises:
            ValidationError: If type is invalid
        """
        if type not in VALID_TYPES:
            raise ValidationError(f"Invalid document type: {type}. Must be one of: {VALID_TYPES}")
        return type

    def __repr__(self):
        """
        String representation of the Document instance.

        Returns:
            str: Formatted string with document details
        """
        return f"<Document(id='{self.id}', filename='{self.filename}', type='{self.type}', status='{self.status}')>"