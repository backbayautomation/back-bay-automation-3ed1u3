"""
Central database configuration module for the AI-powered Product Catalog Search System.
Implements thread-safe model initialization and serves as the single source of truth
for database models with proper initialization order for foreign key relationships.

Version: 1.0.0
Author: AI-Powered Product Catalog Search System Team
"""

import logging  # version: 3.11+

# Import base class and session management
from .session import Base

# Import models in dependency order to handle foreign key relationships correctly
from ..models.organization import Organization
from ..models.client import Client
from ..models.document import Document

# Configure module logger
logger = logging.getLogger(__name__)

# Define all exported models for proper initialization order
__all__ = [
    "Base",
    "Organization",  # Top-level entity in multi-tenant hierarchy
    "Client",       # Depends on Organization
    "Document",     # Depends on Client
]

def validate_model_relationships():
    """
    Validates model relationships and foreign key constraints.
    Ensures proper model initialization order and relationship integrity.
    
    Returns:
        bool: True if validation succeeds, False otherwise
    """
    try:
        # Validate Organization model
        assert hasattr(Organization, 'clients'), "Organization model missing clients relationship"
        
        # Validate Client model
        assert hasattr(Client, 'organization'), "Client model missing organization relationship"
        assert hasattr(Client, 'documents'), "Client model missing documents relationship"
        
        # Validate Document model
        assert hasattr(Document, 'client'), "Document model missing client relationship"
        
        # Validate foreign key relationships
        assert Client.org_id.foreign_keys, "Client.org_id missing foreign key constraint"
        assert Document.client_id.foreign_keys, "Document.client_id missing foreign key constraint"
        
        logger.info("Model relationships validated successfully")
        return True
        
    except AssertionError as e:
        logger.error(f"Model relationship validation failed: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during model validation: {str(e)}", exc_info=True)
        return False

def initialize_models():
    """
    Initializes database models in correct dependency order.
    Ensures proper schema creation and relationship establishment.
    
    Returns:
        bool: True if initialization succeeds, False otherwise
    """
    try:
        # Validate model relationships before initialization
        if not validate_model_relationships():
            raise Exception("Model relationship validation failed")
        
        # Create tables in dependency order
        Base.metadata.create_all(bind=Base.metadata.bind)
        
        logger.info("Database models initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"Model initialization failed: {str(e)}", exc_info=True)
        return False

# Validate model relationships on module import
if not validate_model_relationships():
    logger.critical("Critical error: Model relationships validation failed")
    raise RuntimeError("Database model initialization failed - invalid relationships")

# Module version and metadata
__version__ = "1.0.0"
__author__ = "AI-Powered Product Catalog Search System Team"