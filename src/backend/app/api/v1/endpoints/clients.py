"""
FastAPI router endpoints for client management in the multi-tenant system.
Implements secure CRUD operations with role-based access control, pagination,
filtering, audit logging, and comprehensive error handling.

Version: 1.0.0
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi_limiter import RateLimiter

from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate, Client as ClientSchema
from app.core.auth import get_current_active_user, check_permissions
from app.db.session import get_db
from app.utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/clients", tags=["clients"])

# Initialize structured logger
logger = StructuredLogger("client_endpoints")

# Rate limiting configuration
rate_limiter = RateLimiter(times=100, hours=1)

@router.get("/", response_model=List[ClientSchema])
async def get_clients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    name: Optional[str] = Query(None, description="Filter by client name"),
    sort_by: Optional[str] = Query("name", description="Sort field"),
    sort_order: Optional[str] = Query("asc", description="Sort order (asc/desc)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of records to return"),
) -> List[ClientSchema]:
    """
    Retrieve paginated and filtered list of clients with role-based access control.
    
    Args:
        db: Database session
        current_user: Authenticated user
        name: Optional name filter
        sort_by: Field to sort by
        sort_order: Sort direction
        skip: Pagination offset
        limit: Pagination limit
        
    Returns:
        List[ClientSchema]: List of client records
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check permissions
        if not await check_permissions(current_user, ["system_admin", "client_admin"], current_user.org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to list clients"
            )

        # Build base query
        query = select(Client).where(Client.org_id == current_user.org_id)

        # Apply name filter if provided
        if name:
            query = query.where(Client.name.ilike(f"%{name}%"))

        # Apply sorting
        if sort_order.lower() == "desc":
            query = query.order_by(getattr(Client, sort_by).desc())
        else:
            query = query.order_by(getattr(Client, sort_by).asc())

        # Get total count for pagination
        count_query = select(func.count()).select_from(query.subquery())
        total = await db.scalar(count_query)

        # Apply pagination
        query = query.offset(skip).limit(limit)

        # Execute query
        result = await db.execute(query)
        clients = result.scalars().all()

        # Log access
        logger.log_security_event(
            "client_list_accessed",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "filter": {"name": name},
                "pagination": {"skip": skip, "limit": limit},
                "total_results": total
            }
        )

        return [ClientSchema.from_orm(client) for client in clients]

    except Exception as e:
        logger.log_security_event(
            "client_list_error",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving clients"
        )

@router.get("/{client_id}", response_model=ClientSchema)
async def get_client(
    client_id: UUID = Path(..., description="Client ID to retrieve"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ClientSchema:
    """
    Retrieve a specific client by ID with security checks.
    
    Args:
        client_id: UUID of client to retrieve
        db: Database session
        current_user: Authenticated user
        
    Returns:
        ClientSchema: Client details
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check permissions
        if not await check_permissions(current_user, ["system_admin", "client_admin"], current_user.org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to view client"
            )

        # Query client with org_id check
        query = select(Client).where(
            Client.id == client_id,
            Client.org_id == current_user.org_id
        )
        result = await db.execute(query)
        client = result.scalar_one_or_none()

        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )

        # Log access
        logger.log_security_event(
            "client_accessed",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(client_id)
            }
        )

        return ClientSchema.from_orm(client)

    except HTTPException:
        raise
    except Exception as e:
        logger.log_security_event(
            "client_access_error",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(client_id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving client"
        )

@router.post("/", response_model=ClientSchema, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    background_tasks: BackgroundTasks
) -> ClientSchema:
    """
    Create a new client with security validation and audit logging.
    
    Args:
        client_data: Client creation data
        db: Database session
        current_user: Authenticated user
        background_tasks: Background task handler
        
    Returns:
        ClientSchema: Created client details
        
    Raises:
        HTTPException: For authorization or validation errors
    """
    try:
        # Check permissions
        if not await check_permissions(current_user, ["system_admin"], current_user.org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create client"
            )

        # Create new client
        new_client = Client(
            org_id=current_user.org_id,
            name=client_data.name,
            config=client_data.config,
            branding=client_data.branding
        )

        db.add(new_client)
        await db.commit()
        await db.refresh(new_client)

        # Log creation
        logger.log_security_event(
            "client_created",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(new_client.id),
                "client_name": new_client.name
            }
        )

        # Schedule any background tasks
        background_tasks.add_task(
            setup_client_resources,
            new_client.id,
            current_user.org_id
        )

        return ClientSchema.from_orm(new_client)

    except Exception as e:
        await db.rollback()
        logger.log_security_event(
            "client_creation_error",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating client"
        )

@router.put("/{client_id}", response_model=ClientSchema)
async def update_client(
    client_id: UUID,
    client_data: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> ClientSchema:
    """
    Update an existing client with validation and audit logging.
    
    Args:
        client_id: UUID of client to update
        client_data: Update data
        db: Database session
        current_user: Authenticated user
        
    Returns:
        ClientSchema: Updated client details
        
    Raises:
        HTTPException: For authorization or validation errors
    """
    try:
        # Check permissions
        if not await check_permissions(current_user, ["system_admin"], current_user.org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update client"
            )

        # Query existing client
        query = select(Client).where(
            Client.id == client_id,
            Client.org_id == current_user.org_id
        )
        result = await db.execute(query)
        client = result.scalar_one_or_none()

        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )

        # Update fields
        if client_data.name is not None:
            client.name = client_data.name
        if client_data.config is not None:
            client.update_config(client_data.config)
        if client_data.branding is not None:
            client.update_branding(client_data.branding)

        await db.commit()
        await db.refresh(client)

        # Log update
        logger.log_security_event(
            "client_updated",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(client_id),
                "updated_fields": client_data.dict(exclude_unset=True)
            }
        )

        return ClientSchema.from_orm(client)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.log_security_event(
            "client_update_error",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(client_id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating client"
        )

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    background_tasks: BackgroundTasks
) -> None:
    """
    Delete a client with cascade cleanup and audit logging.
    
    Args:
        client_id: UUID of client to delete
        db: Database session
        current_user: Authenticated user
        background_tasks: Background task handler
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check permissions
        if not await check_permissions(current_user, ["system_admin"], current_user.org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete client"
            )

        # Query existing client
        query = select(Client).where(
            Client.id == client_id,
            Client.org_id == current_user.org_id
        )
        result = await db.execute(query)
        client = result.scalar_one_or_none()

        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )

        # Log deletion before removing
        logger.log_security_event(
            "client_deleted",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(client_id),
                "client_name": client.name
            }
        )

        # Delete client
        await db.delete(client)
        await db.commit()

        # Schedule cleanup tasks
        background_tasks.add_task(
            cleanup_client_resources,
            client_id,
            current_user.org_id
        )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.log_security_event(
            "client_deletion_error",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(client_id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting client"
        )

async def setup_client_resources(client_id: UUID, org_id: UUID) -> None:
    """Background task to set up required resources for new client."""
    logger.log_security_event(
        "client_setup_started",
        {
            "client_id": str(client_id),
            "org_id": str(org_id)
        }
    )
    # Add resource setup logic here

async def cleanup_client_resources(client_id: UUID, org_id: UUID) -> None:
    """Background task to clean up client resources after deletion."""
    logger.log_security_event(
        "client_cleanup_started",
        {
            "client_id": str(client_id),
            "org_id": str(org_id)
        }
    )
    # Add resource cleanup logic here