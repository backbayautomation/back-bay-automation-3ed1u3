from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, UUID, JSON, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship, validates
from sqlalchemy.exc import ValidationError

# Import base from organization model
from app.models.organization import Base
# Import Client model for relationship
from app.models.client import Client

# Global constants for validation
VALID_STATUSES = ['pending', 'processing', 'completed', 'failed']
VALID_TYPES = ['pdf', 'docx', 'xlsx']
MAX_METADATA_SIZE = 1048576  # 1MB limit for metadata JSON

class Document(Base):
    """
    SQLAlchemy model representing a document with enhanced security and validation.
    Implements comprehensive document management with secure multi-tenant isolation,
    status tracking, and relationship handling with robust audit capabilities.
    """
    __tablename__ = 'documents'

    # Define composite indexes for efficient querying
    __table_args__ = (
        Index('ix_documents_client_status', 'client_id', 'status'),
        Index('ix_documents_type_created', 'type', 'created_at')
    )

    # Primary identifier with UUID for security and global uniqueness
    id = Column(UUID, primary_key=True, default=uuid4)
    
    # Client foreign key for tenant isolation
    client_id = Column(
        UUID,
        ForeignKey('clients.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    
    # Document properties
    filename = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    
    # Metadata JSON with schema version and status history
    metadata = Column(
        JSON,
        nullable=False,
        default={'status_history': [], 'schema_version': '1.0'}
    )
    
    # Processing status tracking
    status = Column(String(20), nullable=False, default='pending')
    retry_count = Column(Integer, nullable=False, default=0)
    
    # Audit timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    last_modified = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships
    client = relationship('Client', back_populates='documents')
    chunks = relationship('Chunk', back_populates='document', cascade='all, delete-orphan')

    def __init__(self, client_id, filename, type, metadata=None):
        """
        Initialize document with required fields and validation.
        
        Args:
            client_id (UUID): ID of the owning client
            filename (str): Name of the document file
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
            'schema_version': '1.0'
        }
        if metadata:
            if len(str(metadata)) > MAX_METADATA_SIZE:
                raise ValidationError(f"Metadata size exceeds limit of {MAX_METADATA_SIZE} bytes")
            self.metadata.update(metadata)
        
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
                'status_history': self.metadata.get('status_history'),
                # Exclude sensitive metadata fields
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
            new_status (str): New status value
            
        Raises:
            ValidationError: If status is invalid or transition not allowed
        """
        if new_status not in VALID_STATUSES:
            raise ValidationError(f"Invalid status: {new_status}")
        
        # Validate status transitions
        if self.status == 'completed' and new_status != 'failed':
            raise ValidationError("Cannot change status of completed document")
        
        # Update status and history
        old_status = self.status
        self.status = new_status
        self.metadata['status_history'].append({
            'from': old_status,
            'to': new_status,
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Update related fields
        self.last_modified = datetime.utcnow()
        if new_status == 'completed':
            self.processed_at = datetime.utcnow()
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
        if len(str(new_metadata)) > MAX_METADATA_SIZE:
            raise ValidationError(f"Metadata size exceeds limit of {MAX_METADATA_SIZE} bytes")
        
        # Preserve required metadata fields
        preserved_fields = {
            'status_history': self.metadata.get('status_history', []),
            'schema_version': self.metadata.get('schema_version', '1.0')
        }
        
        # Update metadata
        self.metadata = {
            **new_metadata,
            **preserved_fields
        }
        self.last_modified = datetime.utcnow()

    @validates('type')
    def validate_type(self, key, type_value):
        """
        Validate document type is supported.
        
        Args:
            key (str): Field name being validated
            type_value (str): Document type to validate
            
        Returns:
            str: Validated document type
            
        Raises:
            ValidationError: If type is invalid
        """
        if type_value not in VALID_TYPES:
            raise ValidationError(f"Invalid document type: {type_value}. Must be one of: {VALID_TYPES}")
        return type_value

    def __repr__(self):
        """
        String representation of the Document instance.
        
        Returns:
            str: Formatted string with document details
        """
        return f"Document(id='{self.id}', filename='{self.filename}', type='{self.type}', status='{self.status}')"