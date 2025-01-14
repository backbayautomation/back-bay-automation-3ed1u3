"""
SQLAlchemy model representing chat sessions between users and the AI system.
Implements secure multi-tenant data isolation, encrypted metadata storage,
and comprehensive audit tracking for the chat interface.

Version: 1.0.0
"""

from datetime import datetime
from uuid import uuid4
from typing import Dict, Any

from sqlalchemy import Column, String, Text, Boolean, JSON, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates

from ..db.base import Base
from ..core.security import encrypt_sensitive_data
from .user import User
from .client import Client

class ChatSession(Base):
    """
    SQLAlchemy model representing a secure, multi-tenant chat session between
    a user and the AI system with enhanced security and audit features.
    """
    __tablename__ = 'chat_sessions'

    # Primary identifier with UUID for security and global uniqueness
    id = Column(UUID, primary_key=True, default=uuid4, index=True)
    
    # Multi-tenant relationships with secure isolation
    user_id = Column(
        UUID, 
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    client_id = Column(
        UUID,
        ForeignKey('clients.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    
    # Session metadata
    title = Column(String(255), nullable=False)
    metadata = Column(
        JSON,
        nullable=False,
        default={
            'context': {},
            'preferences': {},
            'analytics': {}
        }
    )
    encrypted_metadata = Column(Text, nullable=True)
    
    # Session state
    status = Column(
        String(20),
        nullable=False,
        default='active',
        index=True
    )
    
    # Audit timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    last_activity_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships with lazy loading
    user = relationship("User", back_populates="chat_sessions", lazy="select")
    client = relationship("Client", back_populates="chat_sessions", lazy="select")
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="select"
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="chat_session",
        cascade="all, delete-orphan",
        lazy="select"
    )

    def __init__(
        self,
        user_id: UUID,
        client_id: UUID,
        title: str,
        metadata: Dict[str, Any],
        status: str = 'active'
    ) -> None:
        """Initialize chat session with required fields and security measures."""
        self.id = uuid4()
        self.user_id = user_id
        self.client_id = client_id
        self.title = title
        
        # Validate and sanitize metadata
        self.metadata = self.validate_metadata(metadata)
        
        # Encrypt sensitive metadata fields
        sensitive_fields = metadata.get('sensitive', {})
        if sensitive_fields:
            self.encrypted_metadata = encrypt_sensitive_data(str(sensitive_fields))
        
        self.status = status
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.last_activity_at = self.created_at
        self.is_active = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert chat session to secure dictionary representation."""
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'client_id': str(self.client_id),
            'title': self.title,
            'metadata': {
                k: v for k, v in self.metadata.items()
                if k not in ['sensitive']
            },
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'last_activity_at': self.last_activity_at.isoformat(),
            'is_active': self.is_active,
            'message_count': len(self.messages) if self.messages else 0
        }

    def update_activity(self) -> None:
        """Update session activity timestamp and status."""
        current_time = datetime.utcnow()
        self.last_activity_at = current_time
        self.updated_at = current_time

    @validates('metadata')
    def validate_metadata(self, key: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and sanitize session metadata."""
        if not isinstance(metadata, dict):
            raise ValueError("Metadata must be a dictionary")

        # Check size limits
        if len(str(metadata)) > 1048576:  # 1MB limit
            raise ValueError("Metadata size exceeds 1MB limit")

        # Required structure
        required_keys = {'context', 'preferences', 'analytics'}
        if not all(key in metadata for key in required_keys):
            raise ValueError(f"Metadata must contain all required keys: {required_keys}")

        # Validate nested dictionaries
        for key in required_keys:
            if not isinstance(metadata.get(key), dict):
                raise ValueError(f"Metadata {key} must be a dictionary")

        # Remove prohibited fields
        prohibited_fields = {'system_data', 'internal'}
        for field in prohibited_fields:
            metadata.pop(field, None)

        return metadata

    def __repr__(self) -> str:
        """String representation of the ChatSession instance."""
        return f"ChatSession(id='{self.id}', title='{self.title}', status='{self.status}')"