"""
Package initializer for FastAPI endpoints module that consolidates and exports all API routers.
Implements modular API structure with role-based access control and multi-tenant support.

Version: 1.0.0
"""

from fastapi import APIRouter  # version: ^0.100.0
import logging

from .auth import router as auth_router
from .users import router as users_router
from .documents import router as documents_router

# Configure module logger
logger = logging.getLogger(__name__)

# Export routers with proper prefixes and tags
auth_router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
    responses={
        401: {"description": "Authentication failed"},
        403: {"description": "Insufficient permissions"},
        429: {"description": "Too many requests"}
    }
)
auth_router.include_router(auth_router)

users_router = APIRouter(
    prefix="/users",
    tags=["user management"],
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient permissions"},
        404: {"description": "User not found"},
        409: {"description": "User already exists"}
    }
)
users_router.include_router(users_router)

documents_router = APIRouter(
    prefix="/documents",
    tags=["document management"],
    responses={
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient permissions"},
        404: {"description": "Document not found"},
        413: {"description": "File too large"},
        415: {"description": "Unsupported file type"}
    }
)
documents_router.include_router(documents_router)

# Log router initialization
logger.info(
    "API routers initialized",
    extra={
        'routers': {
            'auth': auth_router.routes,
            'users': users_router.routes,
            'documents': documents_router.routes
        }
    }
)

# Export all routers
__all__ = [
    "auth_router",
    "users_router", 
    "documents_router"
]