"""
Central database configuration module that imports and re-exports all SQLAlchemy models.
Implements thread-safe model initialization with logging and monitoring capabilities.

Version: 1.0.0
Author: AI-Powered Product Catalog Search System Team
"""

import logging  # version: 3.11+

# Import base class and metadata from session module
from .session import Base, metadata

# Import models in dependency order to ensure proper foreign key relationships
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

# Log model initialization
logger.info(
    "Database models initialized",
    extra={
        'model_count': len(__all__) - 1,  # Subtract 1 to exclude Base
        'tables': list(metadata.tables.keys())
    }
)

def validate_model_relationships():
    """
    Validate model relationships and foreign key constraints.
    Ensures proper model initialization order and relationship configuration.
    
    Returns:
        bool: True if validation successful, False otherwise
    """
    try:
        # Validate Organization -> Client relationship
        assert hasattr(Organization, 'clients'), "Organization missing clients relationship"
        assert Organization.clients.property.target is Client, "Invalid Organization.clients target"
        
        # Validate Client -> Organization relationship
        assert hasattr(Client, 'organization'), "Client missing organization relationship"
        assert Client.organization.property.target is Organization, "Invalid Client.organization target"
        
        # Validate Client -> Document relationship
        assert hasattr(Client, 'documents'), "Client missing documents relationship"
        assert Client.documents.property.target is Document, "Invalid Client.documents target"
        
        # Validate Document -> Client relationship
        assert hasattr(Document, 'client'), "Document missing client relationship"
        assert Document.client.property.target is Client, "Invalid Document.client target"
        
        logger.info(
            "Model relationships validated successfully",
            extra={
                'relationships': {
                    'Organization': ['clients'],
                    'Client': ['organization', 'documents'],
                    'Document': ['client']
                }
            }
        )
        return True
        
    except AssertionError as e:
        logger.error(
            "Model relationship validation failed",
            extra={
                'error': str(e),
                'error_type': 'RelationshipValidationError'
            }
        )
        return False

# Validate relationships on module import
if not validate_model_relationships():
    raise RuntimeError("Database model relationships validation failed")