"""
Pydantic schema models for chat sessions and messages with enhanced validation,
HAL links support, and multi-tenant isolation.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field, constr  # version: ^1.9.0

# Validation constants
MAX_CONTENT_LENGTH = 4096
MAX_TITLE_LENGTH = 255
VALID_ROLES = ["user", "system"]

class MessageBase(BaseModel):
    """Enhanced base Pydantic model for chat messages with strict validation."""
    content: constr(min_length=1, max_length=MAX_CONTENT_LENGTH) = Field(
        ...,
        description="Message content with length validation"
    )
    role: constr(regex=f"^({'|'.join(VALID_ROLES)})$") = Field(
        ...,
        description="Message role (user/system)"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default={
            'context': {},
            'analytics': {}
        },
        description="Optional metadata with required structure"
    )
    client_id: UUID = Field(
        ...,
        description="Client ID for tenant isolation"
    )

    class Config:
        """Enhanced Pydantic model configuration."""
        orm_mode = True
        schema_extra = {
            "example": {
                "content": "What are the specifications for pump model A123?",
                "role": "user",
                "metadata": {
                    "context": {"document_ids": ["abc-123"]},
                    "analytics": {"confidence": 0.95}
                },
                "client_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class MessageCreate(MessageBase):
    """Enhanced schema for creating new chat messages with validation."""
    chat_session_id: UUID = Field(
        ...,
        description="Parent chat session ID"
    )

class MessageResponse(MessageBase):
    """Enhanced schema for message responses with HAL links."""
    id: UUID = Field(
        ...,
        description="Message unique identifier"
    )
    created_at: datetime = Field(
        ...,
        description="Message creation timestamp"
    )
    _links: Dict[str, Dict[str, str]] = Field(
        default_factory=lambda: {
            "self": {},
            "chat_session": {},
            "client": {}
        },
        description="HAL links for related resources"
    )

class ChatSessionBase(BaseModel):
    """Enhanced base Pydantic model for chat sessions."""
    title: constr(min_length=1, max_length=MAX_TITLE_LENGTH) = Field(
        ...,
        description="Chat session title"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default={
            'context': {},
            'preferences': {},
            'analytics': {}
        },
        description="Optional session metadata"
    )
    client_id: UUID = Field(
        ...,
        description="Client ID for tenant isolation"
    )

    class Config:
        """Enhanced Pydantic model configuration."""
        orm_mode = True
        schema_extra = {
            "example": {
                "title": "Product Specifications Query",
                "metadata": {
                    "context": {"product_line": "pumps"},
                    "preferences": {"response_format": "detailed"},
                    "analytics": {"session_duration": 300}
                },
                "client_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class ChatSessionCreate(ChatSessionBase):
    """Enhanced schema for creating new chat sessions."""
    user_id: UUID = Field(
        ...,
        description="User creating the session"
    )

class ChatSessionResponse(ChatSessionBase):
    """Enhanced schema for chat session responses with HAL links."""
    id: UUID = Field(
        ...,
        description="Session unique identifier"
    )
    messages: List[MessageResponse] = Field(
        default_factory=list,
        description="Session messages with pagination"
    )
    created_at: datetime = Field(
        ...,
        description="Session creation timestamp"
    )
    updated_at: datetime = Field(
        ...,
        description="Last update timestamp"
    )
    _links: Dict[str, Dict[str, str]] = Field(
        default_factory=lambda: {
            "self": {},
            "messages": {"href": "/messages{?page,size}"},
            "client": {},
            "user": {}
        },
        description="HAL links for related resources"
    )
    _embedded: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Embedded resources for pagination"
    )