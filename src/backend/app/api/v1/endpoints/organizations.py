"""
FastAPI router endpoints for organization management in the multi-tenant architecture.
Implements secure CRUD operations with comprehensive validation, audit logging, and performance monitoring.

Version: 1.0.0
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi_limiter import RateLimiter
from cachetools import TTLCache
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

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

# Initialize structured logger
logger = StructuredLogger(__name__)

# Configure rate limiting
RATE_LIMIT_CALLS = 100
RATE_LIMIT_PERIOD = 3600  # 1 hour

# Initialize cache for organization responses
organization_cache = TTLCache(maxsize=100, ttl=300)  # 5 minutes TTL

@router.get(
    "/",
    response_model=List[OrganizationResponse],
    status_code=status.HTTP_200_OK,
    description="Get list of all organizations with pagination and filtering (system admin only)"
)
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def get_organizations(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    name_filter: Optional[str] = None
):
    """
    Retrieve paginated list of organizations with optional filtering.
    
    Args:
        db: Database session
        current_user: Authenticated user from token
        skip: Number of records to skip
        limit: Maximum number of records to return
        name_filter: Optional organization name filter
        
    Returns:
        List[OrganizationResponse]: List of organization schemas
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check system admin permission
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

        # Build base query
        query = db.query(Organization)

        # Apply name filter if provided
        if name_filter:
            query = query.filter(Organization.name.ilike(f"%{name_filter}%"))

        # Execute query with pagination
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
        logger.log_security_event(
            "database_error",
            {"error": str(e), "user_id": str(current_user.id)}
        )
        raise handle_db_error(e)
    except Exception as e:
        logger.log_security_event(
            "organization_list_error",
            {"error": str(e), "user_id": str(current_user.id)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving organizations"
        )

@router.get(
    "/{organization_id}",
    response_model=OrganizationResponse,
    status_code=status.HTTP_200_OK,
    description="Get specific organization by ID with tenant isolation"
)
@RateLimiter(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
async def get_organization(
    organization_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve specific organization with tenant isolation.
    
    Args:
        organization_id: UUID of organization to retrieve
        db: Database session
        current_user: Authenticated user from token
        
    Returns:
        OrganizationResponse: Organization schema
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check cache first
        cache_key = f"org_{organization_id}_{current_user.id}"
        if cache_key in organization_cache:
            return organization_cache[cache_key]

        # Check user permissions
        if not await check_user_permissions(
            current_user,
            ["system_admin", "client_admin"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to access organization"
            )

        # Query organization with tenant isolation
        organization = db.query(Organization).filter(
            Organization.id == organization_id
        ).first()

        # Verify organization exists
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )

        # Verify tenant access for client admin
        if (
            current_user.role == "client_admin" and
            current_user.organization_id != organization_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to organization"
            )

        # Log access
        await audit_log(
            db,
            current_user.id,
            "organization_accessed",
            {"organization_id": str(organization_id)}
        )

        # Create response schema
        response = OrganizationResponse.from_orm(organization)

        # Cache response
        organization_cache[cache_key] = response

        return response

    except SQLAlchemyError as e:
        logger.log_security_event(
            "database_error",
            {
                "error": str(e),
                "user_id": str(current_user.id),
                "organization_id": str(organization_id)
            }
        )
        raise handle_db_error(e)
    except HTTPException:
        raise
    except Exception as e:
        logger.log_security_event(
            "organization_access_error",
            {
                "error": str(e),
                "user_id": str(current_user.id),
                "organization_id": str(organization_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving organization"
        )

# Initialize OpenTelemetry instrumentation
FastAPIInstrumentor.instrument_app(router)