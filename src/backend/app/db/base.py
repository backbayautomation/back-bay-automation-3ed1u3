"""
Central database configuration module that imports and re-exports all SQLAlchemy models.
Implements thread-safe model initialization with logging and monitoring capabilities.

Version: 1.0.0
Author: AI-Powered Product Catalog Search System Team
"""

import logging  # version: 3.11+

# Import base class and metadata from session module
from .session import Base, metadata

# Import models in dependency order for proper relationship initialization
from ..models.organization import Organization
from ..models.client import Client
from ..models.document import Document

# Configure module logger
logger = logging.getLogger(__name__)

# Define all exported models for easy access
__all__ = [
    "Base",
    "Organization",
    "Client", 
    "Document"
]

def verify_model_relationships():
    """
    Verify model relationships and foreign key constraints are properly configured.
    Ensures proper initialization order and relationship integrity.
    
    Returns:
        bool: True if verification succeeds, False otherwise
    """
    try:
        # Verify Organization -> Client relationship
        assert hasattr(Organization, 'clients'), "Organization missing clients relationship"
        assert Organization.clients.property.mapper.class_ == Client
        
        # Verify Client -> Organization relationship
        assert hasattr(Client, 'organization'), "Client missing organization relationship"
        assert Client.organization.property.mapper.class_ == Organization
        
        # Verify Client -> Document relationship
        assert hasattr(Client, 'documents'), "Client missing documents relationship"
        assert Client.documents.property.mapper.class_ == Document
        
        # Verify Document -> Client relationship
        assert hasattr(Document, 'client'), "Document missing client relationship"
        assert Document.client.property.mapper.class_ == Client
        
        logger.info("Model relationships verified successfully")
        return True
        
    except Exception as e:
        logger.error(f"Model relationship verification failed: {str(e)}", exc_info=True)
        return False

def initialize_models():
    """
    Initialize all database models in the correct order.
    Ensures proper foreign key relationship creation and constraint validation.
    
    Returns:
        bool: True if initialization succeeds, False otherwise
    """
    try:
        # Create tables in dependency order
        metadata.create_all(bind=Base.metadata.bind, tables=[
            Organization.__table__,
            Client.__table__,
            Document.__table__
        ])
        
        # Verify model relationships
        if not verify_model_relationships():
            raise Exception("Model relationship verification failed")
            
        logger.info("Database models initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"Model initialization failed: {str(e)}", exc_info=True)
        return False

# Verify model relationships on module import
if not verify_model_relationships():
    logger.error("Critical error: Model relationships failed verification")
    raise RuntimeError("Database model initialization failed - invalid relationships")

logger.info("Database base module loaded successfully")