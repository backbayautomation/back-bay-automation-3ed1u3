"""
SQLAlchemy model representing chat messages exchanged between users and the AI system.
Implements secure message storage with multi-tenant isolation, validation, and audit capabilities.

Version: 1.0.0
"""

from datetime import datetime
from uuid import uuid4
from typing import Dict, Optional

from sqlalchemy import Column, String, DateTime, JSON, ForeignKey  # version: ^1.4.0
from sqlalchemy.dialects.postgresql import UUID  # version: ^1.4.0
from sqlalchemy.orm import relationship, validates  # version: ^1.4.0

from ..db.base import Base

# Constants for validation
VALID_ROLES = ['user', 'system']
MAX_CONTENT_LENGTH = 16384  # 16KB limit for message content
MAX_METADATA_SIZE = 4096   # 4KB limit for metadata

class Message(Base):
    """SQLAlchemy model representing a chat message with enhanced security and validation."""
    __tablename__ = 'messages'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4, index=True,
               doc="Unique identifier for the message")
    chat_session_id = Column(UUID, ForeignKey('chat_sessions.id', ondelete='CASCADE'),
                           nullable=False, index=True,
                           doc="Chat session this message belongs to")

    # Message Content Fields
    content = Column(String(MAX_CONTENT_LENGTH), nullable=False,
                    doc="Message content with length validation")
    role = Column(String(10), nullable=False,
                 doc="Message role (user/system)")
    metadata = Column(JSON, nullable=False, default={},
                     doc="Message metadata and context")

    # Audit Fields
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow,
                       doc="Timestamp of message creation")

    # Relationships
    chat_session = relationship("ChatSession", back_populates="messages",
                              doc="Parent chat session relationship")

    def __init__(self, chat_session_id: UUID, content: str, role: str, metadata: Optional[Dict] = None):
        """
        Initialize message with required fields and validation.

        Args:
            chat_session_id: UUID of parent chat session
            content: Message content text
            role: Message role (user/system)
            metadata: Optional message metadata

        Raises:
            ValueError: If validation fails for any field
        """
        if not chat_session_id:
            raise ValueError("Chat session ID is required")

        if not content or len(content) > MAX_CONTENT_LENGTH:
            raise ValueError(f"Content must be between 1 and {MAX_CONTENT_LENGTH} characters")

        self.validate_role(role)
        validated_metadata = self.validate_metadata(metadata or {})

        self.id = uuid4()
        self.chat_session_id = chat_session_id
        self.content = content
        self.role = role
        self.metadata = validated_metadata
        self.created_at = datetime.utcnow()

    def to_dict(self) -> Dict:
        """
        Convert message to dictionary representation with enhanced security.

        Returns:
            dict: Message data dictionary with sanitized content
        """
        return {
            'id': str(self.id),
            'chat_session_id': str(self.chat_session_id),
            'content': self.content,
            'role': self.role,
            'metadata': {
                k: v for k, v in self.metadata.items()
                if k not in ['sensitive', 'internal']  # Exclude sensitive metadata
            },
            'created_at': self.created_at.isoformat()
        }

    @validates('role')
    def validate_role(self, role: str) -> str:
        """
        Validate message role against allowed values.

        Args:
            role: Role to validate

        Returns:
            str: Validated role

        Raises:
            ValueError: If role is invalid
        """
        if not role or role not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {VALID_ROLES}")
        return role

    @validates('metadata')
    def validate_metadata(self, metadata: Dict) -> Dict:
        """
        Validate metadata size and content.

        Args:
            metadata: Metadata dictionary to validate

        Returns:
            dict: Validated metadata

        Raises:
            ValueError: If metadata validation fails
        """
        if not isinstance(metadata, dict):
            raise ValueError("Metadata must be a dictionary")

        # Check size limit
        if len(str(metadata)) > MAX_METADATA_SIZE:
            raise ValueError(f"Metadata size exceeds {MAX_METADATA_SIZE} bytes limit")

        # Validate required structure
        validated = {
            'context': metadata.get('context', {}),
            'processing': metadata.get('processing', {}),
            'source': metadata.get('source', 'chat'),
            'client_info': metadata.get('client_info', {})
        }

        # Remove any sensitive fields
        for key in list(validated.keys()):
            if isinstance(validated[key], dict):
                validated[key] = {
                    k: v for k, v in validated[key].items()
                    if not any(sensitive in k.lower() 
                             for sensitive in ['password', 'token', 'secret', 'key'])
                }

        return validated

    def __repr__(self) -> str:
        """String representation of the Message instance."""
        return f"<Message(id='{self.id}', role='{self.role}')>"