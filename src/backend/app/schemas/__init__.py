"""
Schema module initialization file that exports all Pydantic models for data validation and serialization.
Provides a centralized access point for all schema models with comprehensive type safety, security validation,
and multi-tenant data isolation.

Version: 1.0.0
"""

from typing import List

# Organization schemas
from .organization import (
    OrganizationBase,
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationInDB,
    Organization
)

# User schemas
from .user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDB,
    User
)

# Document schemas
from .document import (
    DocumentBase,
    DocumentCreate,
    DocumentUpdate,
    DocumentInDB,
    Document
)

# Client schemas
from .client import (
    ClientBase,
    ClientCreate,
    ClientUpdate,
    ClientInDB,
    Client
)

# Schema version for API compatibility tracking
__version__ = '1.0.0'

# Define explicit public API
__all__: List[str] = [
    # Organization schemas
    'OrganizationBase',
    'OrganizationCreate',
    'OrganizationUpdate',
    'OrganizationInDB',
    'Organization',
    
    # User schemas
    'UserBase',
    'UserCreate',
    'UserUpdate',
    'UserInDB',
    'User',
    
    # Document schemas
    'DocumentBase',
    'DocumentCreate',
    'DocumentUpdate',
    'DocumentInDB',
    'Document',
    
    # Client schemas
    'ClientBase',
    'ClientCreate',
    'ClientUpdate',
    'ClientInDB',
    'Client',
    
    # Module metadata
    '__version__'
]