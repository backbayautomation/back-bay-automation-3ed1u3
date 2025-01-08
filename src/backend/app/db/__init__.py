"""
Database package initialization module for the AI-powered Product Catalog Search System.
Provides core database components and session management utilities.

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
    "Base",        # SQLAlchemy declarative base for model definitions
    "SessionLocal", # Thread-safe session factory with connection pooling
    "get_db",      # FastAPI database dependency with automatic cleanup
    "init_db"      # Database initialization and schema setup function
]