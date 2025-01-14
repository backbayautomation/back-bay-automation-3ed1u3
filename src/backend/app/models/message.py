"""
SQLAlchemy model representing chat messages exchanged between users and the AI system.
Implements secure message storage with multi-tenant isolation, enhanced validation,
and comprehensive audit capabilities.

Version: 1.0.0
"""

from datetime import datetime
from uuid import uuid4
from typing import Dict, Any, Optional

from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates

from ..db.base import Base

# Constants for validation
VALID_ROLES = ['user', 'system']
MAX_CONTENT_LENGTH = 16384  # 16KB limit for message content
MAX_METADATA_SIZE = 4096   # 4KB limit for metadata

class Message(Base):
    """
    SQLAlchemy model representing a chat message with enhanced security,
    validation, and audit capabilities.
    """
    __tablename__ = 'messages'

    # Primary identifier with UUID for security and global uniqueness
    id = Column(UUID, primary_key=True, default=uuid4, index=True)
    
    # Multi-tenant relationship with secure isolation
    chat_session_id = Column(
        UUID,
        ForeignKey('chat_sessions.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    
    # Message content with length validation
    content = Column(String(MAX_CONTENT_LENGTH), nullable=False)
    
    # Message role (user/system) with validation
    role = Column(String(10), nullable=False)
    
    # Flexible metadata storage with size limits
    metadata = Column(
        JSON,
        nullable=False,
        default={'context': {}, 'analytics': {}}
    )
    
    # Audit timestamp
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        index=True
    )
    
    # Relationship to chat session
    chat_session = relationship(
        "ChatSession",
        back_populates="messages",
        lazy="select"
    )

    def __init__(
        self,
        chat_session_id: UUID,
        content: str,
        role: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Initialize message with required fields and validation.
        
        Args:
            chat_session_id: UUID of the parent chat session
            content: Message content text
            role: Message role (user/system)
            metadata: Optional metadata dictionary
            
        Raises:
            ValueError: If validation fails
        """
        if not chat_session_id:
            raise ValueError("chat_session_id is required")
            
        if len(content) > MAX_CONTENT_LENGTH:
            raise ValueError(f"Content length exceeds maximum of {MAX_CONTENT_LENGTH} characters")
            
        if role not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {VALID_ROLES}")

        self.id = uuid4()
        self.chat_session_id = chat_session_id
        self.content = content
        self.role = role
        self.metadata = self.validate_metadata(metadata or {})
        self.created_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert message to dictionary representation with enhanced metadata.
        
        Returns:
            dict: Message data dictionary with formatted timestamps
        """
        return {
            'id': str(self.id),
            'chat_session_id': str(self.chat_session_id),
            'content': self.content,
            'role': self.role,
            'metadata': {
                k: v for k, v in self.metadata.items()
                if k not in ['sensitive']  # Exclude sensitive metadata
            },
            'created_at': self.created_at.isoformat()
        }

    @validates('role')
    def validate_role(self, key: str, role: str) -> str:
        """
        Validate message role against allowed values.
        
        Args:
            key: Field name being validated
            role: Role value to validate
            
        Returns:
            str: Validated role value
            
        Raises:
            ValueError: If role is invalid
        """
        if role not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {VALID_ROLES}")
        return role

    @validates('metadata')
    def validate_metadata(self, key: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate metadata size and content.
        
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

        # Check size limit
        if len(str(metadata)) > MAX_METADATA_SIZE:
            raise ValueError(f"Metadata size exceeds maximum of {MAX_METADATA_SIZE} bytes")

        # Required structure
        required_keys = {'context', 'analytics'}
        if not all(key in metadata for key in required_keys):
            raise ValueError(f"Metadata must contain all required keys: {required_keys}")

        # Validate nested dictionaries
        for key in required_keys:
            if not isinstance(metadata.get(key), dict):
                raise ValueError(f"Metadata {key} must be a dictionary")

        # Remove any sensitive fields
        metadata.pop('sensitive', None)
        metadata.pop('internal', None)

        return metadata

    def __repr__(self) -> str:
        """String representation of the Message instance."""
        return f"Message(id='{self.id}', role='{self.role}', session_id='{self.chat_session_id}')"