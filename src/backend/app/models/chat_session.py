"""
SQLAlchemy model representing chat sessions between users and the AI system.
Implements secure multi-tenant data isolation, encrypted metadata storage, and audit tracking.

Version: 1.0.0
"""

from datetime import datetime
from uuid import uuid4
from typing import Dict, Optional

from sqlalchemy import Column, String, Text, Boolean, JSON, DateTime, ForeignKey  # version: ^1.4.0
from sqlalchemy.dialects.postgresql import UUID  # version: ^1.4.0
from sqlalchemy.orm import relationship, validates  # version: ^1.4.0

from ..db.base import Base
from ..core.security import encrypt_sensitive_data

class ChatSession(Base):
    """SQLAlchemy model representing a secure, multi-tenant chat session between a user and the AI system."""
    __tablename__ = 'chat_sessions'

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4, index=True,
               doc="Unique identifier for the chat session")
    user_id = Column(UUID, ForeignKey('users.id', ondelete='CASCADE'),
                    nullable=False, index=True,
                    doc="User ID who owns this chat session")
    client_id = Column(UUID, ForeignKey('clients.id', ondelete='CASCADE'),
                      nullable=False, index=True,
                      doc="Client ID for multi-tenant isolation")

    # Session Information Fields
    title = Column(String(255), nullable=False,
                  doc="User-friendly title for the chat session")
    metadata = Column(JSON, nullable=False, default={},
                     doc="Session metadata and configuration")
    encrypted_metadata = Column(Text, nullable=True,
                              doc="Encrypted sensitive metadata")
    status = Column(String(20), nullable=False, default='active',
                   doc="Current session status")

    # Audit Fields
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       doc="Timestamp of session creation")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                       onupdate=datetime.utcnow,
                       doc="Timestamp of last session update")
    last_activity_at = Column(DateTime, nullable=False, default=datetime.utcnow,
                            doc="Timestamp of last session activity")
    is_active = Column(Boolean, nullable=False, default=True,
                      doc="Whether the session is active")

    # Relationships
    user = relationship("User", back_populates="chat_sessions",
                       doc="User who owns this session")
    client = relationship("Client", back_populates="chat_sessions",
                        doc="Client this session belongs to")
    messages = relationship("ChatMessage", back_populates="session",
                          cascade="all, delete-orphan",
                          doc="Messages in this chat session")
    audit_logs = relationship("AuditLog", back_populates="chat_session",
                            cascade="all, delete-orphan",
                            doc="Audit trail for this session")

    def __init__(self, user_id: UUID, client_id: UUID, title: str,
                 metadata: Optional[Dict] = None, status: str = 'active'):
        """Initialize chat session with required fields and security measures."""
        self.id = uuid4()
        self.user_id = user_id
        self.client_id = client_id
        self.title = title
        
        # Validate and set metadata
        validated_metadata = self.validate_metadata(metadata or {})
        self.metadata = validated_metadata
        
        # Encrypt sensitive metadata
        sensitive_fields = validated_metadata.get('sensitive', {})
        if sensitive_fields:
            self.encrypted_metadata = encrypt_sensitive_data(str(sensitive_fields))
        
        self.status = status
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.last_activity_at = self.created_at
        self.is_active = True

    def to_dict(self) -> Dict:
        """Convert chat session to secure dictionary representation."""
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'client_id': str(self.client_id),
            'title': self.title,
            'metadata': {
                k: v for k, v in self.metadata.items()
                if k != 'sensitive'  # Exclude sensitive metadata
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
    def validate_metadata(self, metadata: Dict) -> Dict:
        """Validate and sanitize session metadata."""
        if not isinstance(metadata, dict):
            raise ValueError("Metadata must be a dictionary")

        # Check size limits
        if len(str(metadata)) > 1048576:  # 1MB limit
            raise ValueError("Metadata size exceeds maximum allowed size")

        # Validate required structure
        validated = {
            'context': metadata.get('context', {}),
            'preferences': metadata.get('preferences', {}),
            'history_size': metadata.get('history_size', 10),
            'sensitive': metadata.get('sensitive', {})
        }

        # Sanitize input values
        for key in validated:
            if isinstance(validated[key], dict):
                # Remove any null or empty values
                validated[key] = {k: v for k, v in validated[key].items()
                                if v is not None and v != ""}

        return validated

    def __repr__(self) -> str:
        """String representation of the ChatSession instance."""
        return f"<ChatSession(id='{self.id}', user_id='{self.user_id}', status='{self.status}')>"