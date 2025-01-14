"""
Package initializer for FastAPI endpoints module that consolidates and exports all API routers.
Implements modular API structure with role-based access control and multi-tenant support.

Version: 1.0.0
"""

from fastapi import APIRouter

# Import routers from endpoint modules
from .auth import router as auth_router
from .users import router as users_router
from .documents import router as documents_router

# Export routers for API registration
__all__ = [
    "auth_router",
    "users_router", 
    "documents_router"
]

# Configure router prefixes and tags
auth_router.prefix = "/auth"
auth_router.tags = ["authentication"]

users_router.prefix = "/users"
users_router.tags = ["user-management"]

documents_router.prefix = "/documents"
documents_router.tags = ["document-management"]

# Configure router dependencies and security
# Note: Individual endpoint dependencies are configured in their respective modules
# to ensure proper authentication, authorization and tenant isolation