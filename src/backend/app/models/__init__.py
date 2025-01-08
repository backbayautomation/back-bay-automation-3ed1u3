"""
SQLAlchemy models initialization module for AI-powered Product Catalog Search System.
Implements secure multi-tenant data model with comprehensive relationship management.

Version: 1.0.0
"""

# Import models in dependency order to ensure proper relationship initialization
from .organization import Organization
from .user import User, UserRole
from .client import Client
from .document import Document
from .chunk import Chunk
from .embedding import Embedding
from .chat_session import ChatSession
from .message import Message

# Export all models for easy access while maintaining explicit imports
__all__ = [
    "Organization",  # Multi-tenant organization model
    "User",         # User authentication and authorization
    "UserRole",     # User role enumeration
    "Client",       # Client management within organizations
    "Document",     # Document storage and processing
    "Chunk",        # Document chunk management
    "Embedding",    # Vector embeddings for similarity search
    "ChatSession",  # Chat session management
    "Message"       # Chat message storage
]

# Validate model relationships to ensure proper initialization
def validate_relationships():
    """
    Validate all model relationships are properly configured.
    Ensures data integrity and proper multi-tenant isolation.
    
    Raises:
        RuntimeError: If relationship validation fails
    """
    # Organization relationships
    assert hasattr(Organization, 'clients'), "Organization missing clients relationship"
    
    # User relationships
    assert hasattr(User, 'organization'), "User missing organization relationship"
    assert hasattr(User, 'client'), "User missing client relationship"
    assert hasattr(User, 'chat_sessions'), "User missing chat_sessions relationship"
    
    # Client relationships
    assert hasattr(Client, 'organization'), "Client missing organization relationship"
    assert hasattr(Client, 'documents'), "Client missing documents relationship"
    assert hasattr(Client, 'users'), "Client missing users relationship"
    
    # Document relationships
    assert hasattr(Document, 'client'), "Document missing client relationship"
    assert hasattr(Document, 'chunks'), "Document missing chunks relationship"
    
    # Chunk relationships
    assert hasattr(Chunk, 'document'), "Chunk missing document relationship"
    assert hasattr(Chunk, 'embedding'), "Chunk missing embedding relationship"
    
    # Embedding relationships
    assert hasattr(Embedding, 'chunk'), "Embedding missing chunk relationship"
    
    # ChatSession relationships
    assert hasattr(ChatSession, 'user'), "ChatSession missing user relationship"
    assert hasattr(ChatSession, 'messages'), "ChatSession missing messages relationship"
    
    # Message relationships
    assert hasattr(Message, 'chat_session'), "Message missing chat_session relationship"

# Validate relationships on module import
validate_relationships()