"""
SQLAlchemy model representing chat messages exchanged between users and the AI system.
Implements secure message storage, tracking, and relationships with multi-tenant data isolation.

Version: 1.0.0
"""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates

from ..db.base import Base

# Constants for validation
VALID_ROLES = ['user', 'system']
MAX_CONTENT_LENGTH = 16384  # 16KB limit for message content
MAX_METADATA_SIZE = 4096    # 4KB limit for metadata

class Message(Base):
    """
    SQLAlchemy model representing a chat message with enhanced security,
    validation, and audit capabilities.
    """
    __tablename__ = "messages"
    __table_args__ = {"schema": "tenant"}

    # Primary and Foreign Key Fields
    id = Column(UUID, primary_key=True, default=uuid4, index=True,
               doc="Unique identifier for the message")
    chat_session_id = Column(UUID, ForeignKey("tenant.chat_sessions.id", ondelete="CASCADE"),
                           nullable=False, index=True,
                           doc="Chat session this message belongs to")

    # Message Fields
    content = Column(String(MAX_CONTENT_LENGTH), nullable=False,
                    doc="Message content with length validation")
    role = Column(String(10), nullable=False,
                 doc="Message role (user/system)")
    metadata = Column(JSON, nullable=False,
                     default={"context": {}, "processing": {}, "metrics": {}},
                     doc="Message metadata and processing information")

    # Audit Fields
    created_at = Column(DateTime(timezone=True), nullable=False,
                       default=datetime.utcnow,
                       doc="Timestamp of message creation")

    # Relationships
    chat_session = relationship("ChatSession", back_populates="messages",
                              doc="Parent chat session relationship")

    def __init__(self, chat_session_id: UUID, content: str, role: str, metadata: dict = None):
        """
        Initialize message with required fields and validation.

        Args:
            chat_session_id (UUID): ID of the parent chat session
            content (str): Message content
            role (str): Message role (user/system)
            metadata (dict, optional): Message metadata

        Raises:
            ValueError: If validation fails
        """
        if not chat_session_id:
            raise ValueError("chat_session_id is required")

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

    def to_dict(self) -> dict:
        """
        Convert message to dictionary representation with enhanced metadata.

        Returns:
            dict: Message data dictionary with formatted timestamps
        """
        return {
            "id": str(self.id),
            "chat_session_id": str(self.chat_session_id),
            "content": self.content,
            "role": self.role,
            "metadata": {
                k: v for k, v in self.metadata.items()
                if k not in ["sensitive", "internal"]
            },
            "created_at": self.created_at.isoformat()
        }

    @validates("role")
    def validate_role(self, role: str) -> str:
        """
        Validate message role against allowed values.

        Args:
            role (str): Role to validate

        Returns:
            str: Validated role

        Raises:
            ValueError: If role is invalid
        """
        if not role or role not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {VALID_ROLES}")
        return role

    @validates("metadata")
    def validate_metadata(self, metadata: dict) -> dict:
        """
        Validate metadata size and content.

        Args:
            metadata (dict): Metadata to validate

        Returns:
            dict: Validated metadata

        Raises:
            ValueError: If metadata validation fails
        """
        if not isinstance(metadata, dict):
            raise ValueError("Metadata must be a dictionary")

        # Initialize with defaults if missing
        validated = {
            "context": metadata.get("context", {}),
            "processing": metadata.get("processing", {}),
            "metrics": metadata.get("metrics", {})
        }

        # Validate size
        if len(str(validated)) > MAX_METADATA_SIZE:
            raise ValueError(f"Metadata size exceeds maximum limit of {MAX_METADATA_SIZE} bytes")

        # Remove sensitive fields
        sensitive_fields = {"password", "token", "secret", "key"}
        for section in validated.values():
            if isinstance(section, dict):
                for field in sensitive_fields:
                    section.pop(field, None)

        return validated

    def __repr__(self) -> str:
        """String representation of the Message instance."""
        return f"<Message(id='{self.id}', role='{self.role}', session_id='{self.chat_session_id}')>"