"""
SQLAlchemy model representing chat sessions between users and the AI system.
Implements secure multi-tenant data isolation, encrypted metadata storage,
and comprehensive audit tracking for the chat interface.

Version: 1.0.0
"""

from datetime import datetime
from uuid import uuid4
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
    a user and the AI system with comprehensive security and audit features.
    """
    __tablename__ = "chat_sessions"
    __table_args__ = {"schema": "tenant"}

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4, index=True,
               doc="Unique identifier for the chat session")
    user_id = Column(UUID, ForeignKey("tenant.users.id", ondelete="CASCADE"),
                    nullable=False, index=True,
                    doc="User ID who owns this chat session")
    client_id = Column(UUID, ForeignKey("tenant.clients.id", ondelete="CASCADE"),
                      nullable=False, index=True,
                      doc="Client ID for multi-tenant isolation")

    # Session Fields
    title = Column(String(255), nullable=False,
                  doc="User-friendly title for the chat session")
    metadata = Column(JSON, nullable=False,
                     default={"context": {}, "preferences": {}, "stats": {}},
                     doc="Session metadata and configuration")
    encrypted_metadata = Column(Text, nullable=True,
                              doc="Encrypted sensitive session metadata")
    status = Column(String(20), nullable=False, default="active",
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
                      doc="Whether the session is currently active")

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
                 metadata: dict = None, status: str = "active"):
        """
        Initialize chat session with required fields and security measures.

        Args:
            user_id (UUID): ID of the user creating the session
            client_id (UUID): ID of the client for tenant isolation
            title (str): User-friendly session title
            metadata (dict, optional): Initial session metadata
            status (str, optional): Initial session status
        """
        self.id = uuid4()
        self.user_id = user_id
        self.client_id = client_id
        self.title = title
        
        # Initialize and validate metadata
        validated_metadata = self.validate_metadata(metadata or {})
        self.metadata = validated_metadata
        
        # Encrypt sensitive metadata
        sensitive_data = validated_metadata.get("sensitive", {})
        if sensitive_data:
            self.encrypted_metadata = encrypt_sensitive_data(str(sensitive_data))
        
        self.status = status
        self.created_at = datetime.utcnow()
        self.updated_at = self.created_at
        self.last_activity_at = self.created_at
        self.is_active = True

    def to_dict(self) -> dict:
        """
        Convert chat session to secure dictionary representation.

        Returns:
            dict: Sanitized chat session data dictionary
        """
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "client_id": str(self.client_id),
            "title": self.title,
            "metadata": {
                k: v for k, v in self.metadata.items()
                if k not in ["sensitive"]
            },
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "last_activity_at": self.last_activity_at.isoformat(),
            "is_active": self.is_active,
            "message_count": len(self.messages) if self.messages else 0
        }

    def update_activity(self) -> None:
        """Update session activity timestamp and status."""
        current_time = datetime.utcnow()
        self.last_activity_at = current_time
        self.updated_at = current_time

    @validates("metadata")
    def validate_metadata(self, metadata: dict) -> dict:
        """
        Validate and sanitize session metadata.

        Args:
            metadata (dict): Metadata to validate

        Returns:
            dict: Validated and sanitized metadata

        Raises:
            ValueError: If metadata validation fails
        """
        if not isinstance(metadata, dict):
            raise ValueError("Metadata must be a dictionary")

        # Initialize with defaults if missing
        validated = {
            "context": metadata.get("context", {}),
            "preferences": metadata.get("preferences", {}),
            "stats": metadata.get("stats", {}),
            "sensitive": metadata.get("sensitive", {})
        }

        # Validate size limits
        if len(str(validated)) > 1048576:  # 1MB limit
            raise ValueError("Metadata size exceeds maximum limit")

        # Remove prohibited fields
        prohibited_fields = {"password", "token", "secret"}
        for section in validated.values():
            if isinstance(section, dict):
                for field in prohibited_fields:
                    section.pop(field, None)

        return validated

    def __repr__(self) -> str:
        """String representation of the ChatSession instance."""
        return f"<ChatSession(id='{self.id}', title='{self.title}', status='{self.status}')>"