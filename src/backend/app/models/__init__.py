"""
Initialization module for SQLAlchemy models in the AI-powered Product Catalog Search System.
Implements multi-tenant data model with comprehensive security and relationship management.

Version: 1.0.0
"""

# Import models in dependency order to handle foreign key relationships correctly
from .organization import Organization
from .user import User, UserRole
from .client import Client
from .document import Document
from .chunk import Chunk
from .embedding import Embedding
from .chat_session import ChatSession
from .message import Message

# Export all models for external use with proper documentation
__all__ = [
    "Organization",  # Top-level entity in multi-tenant hierarchy
    "User",         # User management with role-based access
    "UserRole",     # Enumeration of user roles
    "Client",       # Client management for multi-tenant system
    "Document",     # Document management and processing
    "Chunk",        # Document chunking for vector search
    "Embedding",    # Vector embeddings for semantic search
    "ChatSession",  # Chat session management
    "Message"       # Chat message handling
]

# Version information
__version__ = "1.0.0"
__author__ = "AI-Powered Product Catalog Search System Team"

# Module documentation
__doc__ = """
SQLAlchemy models package implementing a secure multi-tenant data model for the
AI-powered Product Catalog Search System. Provides comprehensive data management
with proper relationship handling and security controls.

Models:
- Organization: Top-level tenant entity with isolation
- User: User management with role-based access control
- Client: Client-specific data and configuration
- Document: Document processing and management
- Chunk: Document chunking for vector search
- Embedding: Vector embeddings for semantic search
- ChatSession: Chat interaction management
- Message: Chat message handling

Security Features:
- Multi-tenant data isolation
- Role-based access control
- Audit logging
- Encrypted sensitive data
"""