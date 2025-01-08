"""
Pydantic schema models for chat sessions and messages with enhanced validation,
HAL links support, and multi-tenant isolation.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field, constr  # version: ^1.9.0

# Custom type for HAL links
HalLinks = Dict[str, Dict[str, str]]

class MessageBase(BaseModel):
    """Enhanced base Pydantic model for chat messages with strict validation."""
    content: constr(min_length=1, max_length=4096) = Field(
        ...,
        description="Message content with length validation",
        example="What are the specifications for pump model A123?"
    )
    role: constr(regex='^(user|system)$') = Field(
        ...,
        description="Message role (user/system)",
        example="user"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default={},
        description="Message metadata and context",
        example={
            "context": {"document_id": "123"},
            "processing": {"confidence": 0.95},
            "source": "chat"
        }
    )
    client_id: UUID = Field(
        ...,
        description="Client ID for tenant isolation"
    )

    class Config:
        """Enhanced Pydantic model configuration."""
        schema_extra = {
            "example": {
                "content": "What are the specifications for pump model A123?",
                "role": "user",
                "metadata": {
                    "context": {"document_id": "123"},
                    "processing": {"confidence": 0.95},
                    "source": "chat"
                },
                "client_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
        orm_mode = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class MessageCreate(MessageBase):
    """Enhanced schema for creating new chat messages with validation."""
    chat_session_id: UUID = Field(
        ...,
        description="ID of the parent chat session",
        example="550e8400-e29b-41d4-a716-446655440000"
    )

class MessageResponse(MessageBase):
    """Enhanced schema for message responses with HAL links."""
    id: UUID = Field(
        ...,
        description="Unique message identifier"
    )
    created_at: datetime = Field(
        ...,
        description="Message creation timestamp"
    )
    _links: HalLinks = Field(
        default_factory=lambda: {
            "self": {"href": "/api/v1/messages/{id}"},
            "chat_session": {"href": "/api/v1/chat-sessions/{chat_session_id}"}
        },
        description="HAL links for related resources"
    )

class ChatSessionBase(BaseModel):
    """Enhanced base Pydantic model for chat sessions."""
    title: constr(min_length=1, max_length=255) = Field(
        ...,
        description="Chat session title",
        example="Product Specifications Query"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default={},
        description="Session metadata and configuration",
        example={
            "context": {"product_line": "pumps"},
            "preferences": {"response_format": "detailed"}
        }
    )
    client_id: UUID = Field(
        ...,
        description="Client ID for tenant isolation"
    )

    class Config:
        """Enhanced Pydantic model configuration."""
        schema_extra = {
            "example": {
                "title": "Product Specifications Query",
                "metadata": {
                    "context": {"product_line": "pumps"},
                    "preferences": {"response_format": "detailed"}
                },
                "client_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
        orm_mode = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class ChatSessionCreate(ChatSessionBase):
    """Enhanced schema for creating new chat sessions."""
    user_id: UUID = Field(
        ...,
        description="ID of the user creating the session",
        example="550e8400-e29b-41d4-a716-446655440000"
    )

class ChatSessionResponse(ChatSessionBase):
    """Enhanced schema for chat session responses with HAL links."""
    id: UUID = Field(
        ...,
        description="Unique session identifier"
    )
    messages: List[MessageResponse] = Field(
        default_factory=list,
        description="Messages in this chat session"
    )
    created_at: datetime = Field(
        ...,
        description="Session creation timestamp"
    )
    updated_at: datetime = Field(
        ...,
        description="Last session update timestamp"
    )
    _links: HalLinks = Field(
        default_factory=lambda: {
            "self": {"href": "/api/v1/chat-sessions/{id}"},
            "messages": {"href": "/api/v1/chat-sessions/{id}/messages"},
            "user": {"href": "/api/v1/users/{user_id}"}
        },
        description="HAL links for related resources"
    )
    _embedded: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Embedded resources (e.g., latest messages)"
    )