"""
FastAPI router endpoints for organization management in the multi-tenant architecture.
Implements secure CRUD operations with comprehensive validation, audit logging, and performance monitoring.

Version: 1.0.0
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi_limiter import RateLimiter
from cachetools import TTLCache
from opentelemetry.instrumentation.fastapi import monitor_performance

from ....models.organization import Organization
from ....schemas.organization import (
    OrganizationCreate, 
    OrganizationUpdate, 
    OrganizationResponse
)
from ....services.auth import get_current_user, check_user_permissions, audit_log
from ....db.session import get_db, handle_db_error
from ....core.security import encrypt_sensitive_data
from ....utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/organizations", tags=["organizations"])

# Initialize structured logger
logger = StructuredLogger(__name__)

# Initialize cache for organization data
organization_cache = TTLCache(maxsize=100, ttl=300)  # 5 minutes TTL

# Rate limiting configuration
RATE_LIMIT_CALLS = 100
RATE_LIMIT_PERIOD = 3600  # 1 hour

@router.get("/", response_model=List[OrganizationResponse])
@monitor_performance
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def get_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    name_filter: Optional[str] = None
):
    """
    Retrieve paginated list of organizations with optional filtering.
    Only accessible by system administrators.

    Args:
        db: Database session
        current_user: Authenticated user
        skip: Number of records to skip
        limit: Maximum number of records to return
        name_filter: Optional organization name filter

    Returns:
        List[OrganizationResponse]: Paginated list of organizations
    """
    try:
        # Check system admin permissions
        if not await check_user_permissions(current_user, ["system_admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only system administrators can view all organizations"
            )

        # Validate pagination parameters
        if skip < 0 or limit < 1 or limit > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid pagination parameters"
            )

        # Build query with optional name filter
        query = db.query(Organization)
        if name_filter:
            query = query.filter(Organization.name.ilike(f"%{name_filter}%"))

        # Execute paginated query
        organizations = query.offset(skip).limit(limit).all()

        # Log access
        await audit_log(
            db,
            current_user.id,
            "organization_list_accessed",
            {"skip": skip, "limit": limit, "name_filter": name_filter}
        )

        # Return organization list
        return [OrganizationResponse.from_orm(org) for org in organizations]

    except SQLAlchemyError as e:
        await handle_db_error(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        logger.error("Error retrieving organizations", extra={"error": str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/{organization_id}", response_model=OrganizationResponse)
@monitor_performance
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def get_organization(
    organization_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve specific organization by ID with tenant isolation.

    Args:
        organization_id: UUID of organization to retrieve
        db: Database session
        current_user: Authenticated user

    Returns:
        OrganizationResponse: Organization details
    """
    try:
        # Check cache first
        cache_key = f"org_{organization_id}"
        if cache_key in organization_cache:
            return organization_cache[cache_key]

        # Check user permissions for organization access
        has_access = await check_user_permissions(
            current_user,
            ["system_admin", "client_admin"],
            organization_id
        )
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to access this organization"
            )

        # Query organization with tenant isolation
        organization = db.query(Organization).filter(
            Organization.id == organization_id
        ).first()

        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )

        # Log access
        await audit_log(
            db,
            current_user.id,
            "organization_accessed",
            {"organization_id": str(organization_id)}
        )

        # Create response and cache it
        response = OrganizationResponse.from_orm(organization)
        organization_cache[cache_key] = response

        return response

    except SQLAlchemyError as e:
        await handle_db_error(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error retrieving organization",
            extra={"error": str(e), "organization_id": str(organization_id)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )