"""
SQLAlchemy models initialization module for the AI-powered Product Catalog Search System.
Implements secure multi-tenant data model with comprehensive relationship management
and enterprise-grade security features.

Version: 1.0.0
"""

from .organization import Organization
from .user import User, UserRole
from .client import Client
from .document import Document
from .chunk import Chunk
from .embedding import Embedding
from .chat_session import ChatSession
from .message import Message

# Define all exported models for easy access
__all__ = [
    "Organization",
    "User",
    "UserRole",
    "Client",
    "Document",
    "Chunk",
    "Embedding",
    "ChatSession",
    "Message"
]

# Verify model relationships and dependencies
def verify_model_relationships():
    """
    Verify all model relationships are properly configured.
    Ensures data integrity and proper multi-tenant isolation.
    
    Returns:
        bool: True if verification succeeds, False otherwise
    """
    try:
        # Organization relationships
        assert hasattr(Organization, 'clients'), "Organization missing clients relationship"
        assert Organization.clients.property.mapper.class_ == Client
        
        # Client relationships
        assert hasattr(Client, 'organization'), "Client missing organization relationship"
        assert Client.organization.property.mapper.class_ == Organization
        assert hasattr(Client, 'documents'), "Client missing documents relationship"
        assert Client.documents.property.mapper.class_ == Document
        assert hasattr(Client, 'users'), "Client missing users relationship"
        assert Client.users.property.mapper.class_ == User
        
        # Document relationships
        assert hasattr(Document, 'client'), "Document missing client relationship"
        assert Document.client.property.mapper.class_ == Client
        assert hasattr(Document, 'chunks'), "Document missing chunks relationship"
        assert Document.chunks.property.mapper.class_ == Chunk
        
        # Chunk relationships
        assert hasattr(Chunk, 'document'), "Chunk missing document relationship"
        assert Chunk.document.property.mapper.class_ == Document
        assert hasattr(Chunk, 'embedding'), "Chunk missing embedding relationship"
        assert Chunk.embedding.property.mapper.class_ == Embedding
        
        # Embedding relationships
        assert hasattr(Embedding, 'chunk'), "Embedding missing chunk relationship"
        assert Embedding.chunk.property.mapper.class_ == Chunk
        
        # ChatSession relationships
        assert hasattr(ChatSession, 'user'), "ChatSession missing user relationship"
        assert ChatSession.user.property.mapper.class_ == User
        assert hasattr(ChatSession, 'messages'), "ChatSession missing messages relationship"
        assert ChatSession.messages.property.mapper.class_ == Message
        
        # Message relationships
        assert hasattr(Message, 'chat_session'), "Message missing chat_session relationship"
        assert Message.chat_session.property.mapper.class_ == ChatSession
        
        return True
        
    except AssertionError as e:
        import logging
        logging.error(f"Model relationship verification failed: {str(e)}")
        return False

# Verify relationships on module import
if not verify_model_relationships():
    raise RuntimeError("Critical error: Database model relationships failed verification")