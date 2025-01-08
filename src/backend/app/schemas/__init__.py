"""
Schema module initialization file for the AI-powered Product Catalog Search System.
Provides centralized access to all Pydantic models with comprehensive type safety,
security validation, and multi-tenant data isolation.

Version: 1.0.0
"""

from typing import List

# Import organization schemas
from .organization import (
    OrganizationBase,
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationInDB,
    Organization
)

# Import user schemas
from .user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDB,
    User
)

# Import document schemas
from .document import (
    DocumentBase,
    DocumentCreate,
    DocumentUpdate,
    DocumentInDB,
    Document
)

# Define explicit public API
__all__: List[str] = [
    # Organization schemas
    "OrganizationBase",
    "OrganizationCreate", 
    "OrganizationUpdate",
    "OrganizationInDB",
    "Organization",
    
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate", 
    "UserInDB",
    "User",
    
    # Document schemas
    "DocumentBase",
    "DocumentCreate",
    "DocumentUpdate",
    "DocumentInDB", 
    "Document"
]

# Schema version for API compatibility tracking
__version__ = "1.0.0"