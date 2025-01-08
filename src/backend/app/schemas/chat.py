"""
Pydantic schema models for chat sessions and messages with enhanced validation,
HAL links support, and multi-tenant data isolation.

Version: 1.0.0
"""

from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, UUID4, Field, constr  # version: 1.9.0

class MessageBase(BaseModel):
    """Enhanced base Pydantic model for chat messages with strict validation."""
    content: constr(min_length=1, max_length=4096) = Field(
        ...,
        description="Message content with length validation"
    )
    role: constr(regex='^(user|system)$') = Field(
        ...,
        description="Message role (user/system)"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default={
            "context": {},
            "processing": {},
            "metrics": {}
        },
        description="Message metadata and processing information"
    )
    client_id: UUID4 = Field(
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
                    "context": {"document_refs": []},
                    "processing": {"tokens": 15},
                    "metrics": {"response_time": 0.5}
                },
                "client_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class MessageCreate(MessageBase):
    """Enhanced schema for creating new chat messages with validation."""
    chat_session_id: UUID4 = Field(
        ...,
        description="ID of the parent chat session"
    )

class MessageResponse(MessageBase):
    """Enhanced schema for message responses with HAL links."""
    id: UUID4 = Field(..., description="Message unique identifier")
    created_at: datetime = Field(..., description="Message creation timestamp")
    _links: Dict[str, Dict[str, str]] = Field(
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
        description="User-friendly session title"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default={
            "context": {},
            "preferences": {},
            "stats": {}
        },
        description="Session metadata and configuration"
    )
    client_id: UUID4 = Field(
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
                    "stats": {"message_count": 0}
                },
                "client_id": "550e8400-e29b-41d4-a716-446655440000"
            }
        }
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ChatSessionCreate(ChatSessionBase):
    """Enhanced schema for creating new chat sessions."""
    user_id: UUID4 = Field(
        ...,
        description="ID of the user creating the session"
    )

class ChatSessionResponse(ChatSessionBase):
    """Enhanced schema for chat session responses with HAL links."""
    id: UUID4 = Field(..., description="Session unique identifier")
    messages: List[MessageResponse] = Field(
        default_factory=list,
        description="Messages in this chat session"
    )
    created_at: datetime = Field(..., description="Session creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    _links: Dict[str, Dict[str, str]] = Field(
        default_factory=lambda: {
            "self": {"href": "/api/v1/chat-sessions/{id}"},
            "messages": {"href": "/api/v1/chat-sessions/{id}/messages"},
            "user": {"href": "/api/v1/users/{user_id}"}
        },
        description="HAL links for related resources"
    )
    _embedded: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Embedded resources for pagination support"
    )