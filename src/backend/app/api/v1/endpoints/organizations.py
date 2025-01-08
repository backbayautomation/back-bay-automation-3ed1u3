"""
FastAPI router endpoints for organization management in the multi-tenant architecture.
Implements secure CRUD operations with comprehensive validation, audit logging, and performance monitoring.

Version: 1.0.0
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from cachetools import TTLCache  # version: 5.0.0
from opentelemetry.instrumentation import monitor_performance  # version: 0.40.0
from fastapi_limiter import RateLimiter  # version: 0.1.5

from ....models.organization import Organization
from ....schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse
)
from ....services.auth import get_current_user, check_user_permissions, audit_log
from ....db.session import get_db, handle_db_error
from ....utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/organizations", tags=["organizations"])

# Initialize logger
logger = StructuredLogger(__name__)

# Configure rate limiting
RATE_LIMIT_CALLS = 100
RATE_LIMIT_PERIOD = 3600  # 1 hour

# Initialize cache for organization data
organization_cache = TTLCache(maxsize=100, ttl=300)  # 5 minutes TTL

@router.get("/", response_model=List[OrganizationResponse])
@monitor_performance
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def get_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    name_filter: Optional[str] = Query(None, min_length=1, max_length=100)
) -> List[OrganizationResponse]:
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
        List[OrganizationResponse]: List of organization schemas

    Raises:
        HTTPException: If user lacks permissions or database error occurs
    """
    try:
        # Check system admin permissions
        if not await check_user_permissions(current_user, ["system_admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only system administrators can view all organizations"
            )

        # Build base query
        query = db.query(Organization)

        # Apply name filter if provided
        if name_filter:
            query = query.filter(Organization.name.ilike(f"%{name_filter}%"))

        # Apply pagination
        organizations = query.offset(skip).limit(limit).all()

        # Log access
        await audit_log(
            db,
            current_user.id,
            "organization_list_accessed",
            {"skip": skip, "limit": limit, "name_filter": name_filter}
        )

        return [OrganizationResponse.from_orm(org) for org in organizations]

    except SQLAlchemyError as e:
        await handle_db_error(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
    except Exception as e:
        logger.error(f"Error retrieving organizations: {str(e)}")
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
) -> OrganizationResponse:
    """
    Retrieve specific organization by ID with tenant isolation.

    Args:
        organization_id: UUID of organization to retrieve
        db: Database session
        current_user: Authenticated user

    Returns:
        OrganizationResponse: Organization schema

    Raises:
        HTTPException: If organization not found or user lacks permissions
    """
    try:
        # Check cache first
        cache_key = f"org_{organization_id}"
        if cache_key in organization_cache:
            return organization_cache[cache_key]

        # Check user permissions
        if not await check_user_permissions(
            current_user,
            ["system_admin", "client_admin"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
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

        # Verify tenant access for client admins
        if current_user.role == "client_admin" and \
           organization.id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this organization"
            )

        # Log access
        await audit_log(
            db,
            current_user.id,
            "organization_accessed",
            {"organization_id": str(organization_id)}
        )

        # Cache result
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
        logger.error(f"Error retrieving organization: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )