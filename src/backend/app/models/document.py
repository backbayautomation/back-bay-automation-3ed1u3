from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, UUID, JSON, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship, validates
from sqlalchemy.exc import ValidationError
from app.models.client import Client

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
    client_id = Column(UUID, ForeignKey('clients.id', ondelete='CASCADE'),
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
    
    # Audit and Processing Fields
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
        {'extend_existing': True}
    )

    def __init__(self, client_id, filename, type, metadata=None):
        """
        Initialize document with required fields and validation.

        Args:
            client_id (UUID): Client identifier for tenant isolation
            filename (str): Original document filename
            type (str): Document type (must be in VALID_TYPES)
            metadata (dict, optional): Initial metadata for the document

        Raises:
            ValidationError: If validation fails for any field
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
        
        if metadata and len(str(metadata)) > MAX_METADATA_SIZE:
            raise ValidationError("Metadata size exceeds maximum allowed size")

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
            'retry_count': self.retry_count
        }

    def update_status(self, new_status):
        """
        Update document processing status with validation and history.

        Args:
            new_status (str): New status value (must be in VALID_STATUSES)

        Raises:
            ValidationError: If status transition is invalid
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
        self.status = new_status
        self.metadata['status_history'].append({
            'status': new_status,
            'timestamp': datetime.utcnow().isoformat(),
            'retry_count': self.retry_count
        })
        
        self.last_modified = datetime.utcnow()
        
        if new_status == 'completed':
            self.processed_at = datetime.utcnow()
        elif new_status == 'failed':
            self.retry_count += 1

    def update_metadata(self, new_metadata):
        """
        Update document metadata with validation and size checks.

        Args:
            new_metadata (dict): New metadata to merge with existing

        Raises:
            ValidationError: If metadata validation fails
        """
        if len(str(new_metadata)) > MAX_METADATA_SIZE:
            raise ValidationError("New metadata size exceeds maximum allowed size")

        # Preserve required metadata fields
        preserved_fields = {
            'status_history': self.metadata.get('status_history', []),
            'schema_version': self.metadata.get('schema_version', '1.0')
        }
        
        # Validate metadata schema based on document type
        if self.type == 'pdf':
            required_keys = {'page_count', 'text_content'}
        elif self.type == 'docx':
            required_keys = {'word_count', 'paragraph_count'}
        elif self.type == 'xlsx':
            required_keys = {'sheet_count', 'cell_count'}
            
        if not all(key in new_metadata for key in required_keys):
            raise ValidationError(f"Missing required metadata keys for type {self.type}: {required_keys}")

        # Update metadata and timestamp
        self.metadata = {**new_metadata, **preserved_fields}
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
        return f"<Document(id='{self.id}', type='{self.type}', status='{self.status}')>"