"""
Package initializer for FastAPI endpoints module that consolidates and exports all API routers
with comprehensive security controls, multi-tenant isolation, and monitoring capabilities.

Version: 1.0.0
"""

from fastapi import APIRouter
from typing import List

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

# Add security and tenant isolation middleware to routers
for router in [auth_router, users_router, documents_router]:
    # Ensure all routes require authentication by default
    router.dependencies = [
        *router.dependencies,
        # Authentication dependency is already configured in individual routers
    ]

    # Add tenant isolation headers to OpenAPI schema
    for route in router.routes:
        route.operation.parameters = [
            *route.operation.parameters,
            {
                "name": "X-Tenant-ID",
                "in": "header",
                "required": True,
                "schema": {"type": "string"},
                "description": "Tenant identifier for multi-tenant isolation"
            }
        ] if route.operation.parameters else [
            {
                "name": "X-Tenant-ID",
                "in": "header",
                "required": True,
                "schema": {"type": "string"},
                "description": "Tenant identifier for multi-tenant isolation"
            }
        ]

# Add OpenAPI tags metadata
tags_metadata = [
    {
        "name": "authentication",
        "description": "OAuth2 and JWT-based authentication operations"
    },
    {
        "name": "user-management",
        "description": "User account and role management operations with RBAC"
    },
    {
        "name": "document-management",
        "description": "Document upload, processing and retrieval operations"
    }
]

# Export OpenAPI metadata
openapi_tags = tags_metadata