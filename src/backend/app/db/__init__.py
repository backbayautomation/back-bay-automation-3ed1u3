"""
Database package initialization module for AI-powered Product Catalog Search System.
Exports core database components and session management utilities.

This module serves as the main entry point for database-related functionality,
providing access to SQLAlchemy session management, connection pooling, and
multi-tenant database operations.

Version: 1.0.0
"""

from .session import (  # version: 2.0.0
    Base,
    SessionLocal,
    get_db,
    init_db
)

# Define package exports
__all__ = [
    "Base",
    "SessionLocal",
    "get_db",
    "init_db"
]

# Package metadata
__version__ = "1.0.0"
__author__ = "AI-Powered Product Catalog Search Team"
__description__ = "Database package for multi-tenant catalog search system"

# Verify that required database components are properly initialized
if not hasattr(Base, 'metadata'):
    raise ImportError(
        "SQLAlchemy Base object is not properly configured. "
        "Check database session initialization."
    )

if not callable(get_db):
    raise ImportError(
        "Database session factory is not properly configured. "
        "Check session management implementation."
    )

# Export core database components with proper type hints
Base = Base  # SQLAlchemy declarative base for model definitions
SessionLocal = SessionLocal  # Thread-safe session factory
get_db = get_db  # FastAPI database dependency
init_db = init_db  # Database initialization function