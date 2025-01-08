"""
Database package initialization module for the AI-powered Product Catalog Search System.
Provides core database components and session management utilities.

Version: 1.0.0
"""

# Import core database components from session module
from .session import (  # version: 2.0.0
    Base,
    SessionLocal,
    get_db,
    init_db
)

# Define package exports
__all__ = [
    "Base",       # SQLAlchemy declarative base for model definitions
    "SessionLocal", # Thread-safe session factory
    "get_db",     # FastAPI database dependency
    "init_db"     # Database initialization function
]

# Package metadata
__version__ = "1.0.0"
__author__ = "AI-Powered Product Catalog Search Team"
__description__ = "Database package for multi-tenant catalog search system"