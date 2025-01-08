"""
FastAPI router endpoints for client management in the multi-tenant system.
Implements secure CRUD operations with role-based access control, pagination,
filtering, audit logging, and comprehensive error handling.

Version: 1.0.0
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query, Path, BackgroundTasks  # version: ^0.100.0
from sqlalchemy.ext.asyncio import AsyncSession  # version: ^1.4.0
from sqlalchemy import select, func, desc, asc
from fastapi_limiter import RateLimiter  # version: ^0.1.5

from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate, Client as ClientSchema
from app.core.auth import get_current_active_user, check_permissions
from app.db.session import get_db
from app.utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/clients", tags=["clients"])

# Initialize structured logger
logger = StructuredLogger(__name__)

# Rate limiting configuration
rate_limiter = RateLimiter(times=100, hours=1)

@router.get("/", response_model=List[ClientSchema])
async def get_clients(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
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
        current_user: Authenticated user from token
        name: Optional name filter
        sort_by: Field to sort by
        sort_order: Sort direction
        skip: Pagination offset
        limit: Pagination limit
        
    Returns:
        List[ClientSchema]: List of client objects
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check user permissions
        if not await check_permissions(current_user, ["system_admin", "client_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Build base query
        query = select(Client)

        # Apply tenant isolation
        if current_user.role != "system_admin":
            query = query.filter(Client.org_id == current_user.org_id)

        # Apply name filter if provided
        if name:
            query = query.filter(Client.name.ilike(f"%{name}%"))

        # Apply sorting
        sort_column = getattr(Client, sort_by, Client.name)
        if sort_order == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))

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
                "filters": {"name": name},
                "results": len(clients)
            }
        )

        return [ClientSchema.from_orm(client) for client in clients]

    except Exception as e:
        logger.log_security_event(
            "client_list_error",
            {
                "user_id": str(current_user.id),
                "error": str(e)
            }
        )
        raise HTTPException(status_code=500, detail="Error retrieving clients")

@router.get("/{client_id}", response_model=ClientSchema)
async def get_client(
    client_id: UUID = Path(..., description="Client ID to retrieve"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> ClientSchema:
    """
    Retrieve a specific client by ID with security checks.
    
    Args:
        client_id: UUID of client to retrieve
        db: Database session
        current_user: Authenticated user from token
        
    Returns:
        ClientSchema: Client object if found
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check user permissions
        if not await check_permissions(current_user, ["system_admin", "client_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Query client with tenant isolation
        query = select(Client).filter(Client.id == client_id)
        if current_user.role != "system_admin":
            query = query.filter(Client.org_id == current_user.org_id)

        result = await db.execute(query)
        client = result.scalar_one_or_none()

        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        # Log access
        logger.log_security_event(
            "client_accessed",
            {
                "user_id": str(current_user.id),
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
                "client_id": str(client_id),
                "error": str(e)
            }
        )
        raise HTTPException(status_code=500, detail="Error retrieving client")

@router.post("/", response_model=ClientSchema)
async def create_client(
    client: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> ClientSchema:
    """
    Create a new client with security validation and audit logging.
    
    Args:
        client: Client creation data
        db: Database session
        current_user: Authenticated user from token
        background_tasks: Background task queue
        
    Returns:
        ClientSchema: Created client object
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check user permissions
        if not await check_permissions(current_user, ["system_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Create new client instance
        db_client = Client(
            org_id=client.org_id,
            name=client.name,
            config=client.config,
            branding=client.branding
        )

        # Add to database
        db.add(db_client)
        await db.commit()
        await db.refresh(db_client)

        # Schedule background tasks
        background_tasks.add_task(
            logger.log_security_event,
            "client_created",
            {
                "user_id": str(current_user.id),
                "client_id": str(db_client.id),
                "org_id": str(client.org_id)
            }
        )

        return ClientSchema.from_orm(db_client)

    except Exception as e:
        await db.rollback()
        logger.log_security_event(
            "client_creation_error",
            {
                "user_id": str(current_user.id),
                "error": str(e)
            }
        )
        raise HTTPException(status_code=500, detail="Error creating client")

@router.put("/{client_id}", response_model=ClientSchema)
async def update_client(
    client_id: UUID,
    client_update: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> ClientSchema:
    """
    Update an existing client with validation and audit logging.
    
    Args:
        client_id: UUID of client to update
        client_update: Client update data
        db: Database session
        current_user: Authenticated user from token
        
    Returns:
        ClientSchema: Updated client object
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check user permissions
        if not await check_permissions(current_user, ["system_admin", "client_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Query existing client
        query = select(Client).filter(Client.id == client_id)
        if current_user.role != "system_admin":
            query = query.filter(Client.org_id == current_user.org_id)

        result = await db.execute(query)
        db_client = result.scalar_one_or_none()

        if not db_client:
            raise HTTPException(status_code=404, detail="Client not found")

        # Update fields
        update_data = client_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_client, field, value)

        await db.commit()
        await db.refresh(db_client)

        # Log update
        logger.log_security_event(
            "client_updated",
            {
                "user_id": str(current_user.id),
                "client_id": str(client_id),
                "updated_fields": list(update_data.keys())
            }
        )

        return ClientSchema.from_orm(db_client)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.log_security_event(
            "client_update_error",
            {
                "user_id": str(current_user.id),
                "client_id": str(client_id),
                "error": str(e)
            }
        )
        raise HTTPException(status_code=500, detail="Error updating client")

@router.delete("/{client_id}")
async def delete_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> dict:
    """
    Delete a client with security validation and cascade handling.
    
    Args:
        client_id: UUID of client to delete
        db: Database session
        current_user: Authenticated user from token
        
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Check user permissions
        if not await check_permissions(current_user, ["system_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Query client
        query = select(Client).filter(Client.id == client_id)
        result = await db.execute(query)
        db_client = result.scalar_one_or_none()

        if not db_client:
            raise HTTPException(status_code=404, detail="Client not found")

        # Delete client (cascade will handle related records)
        await db.delete(db_client)
        await db.commit()

        # Log deletion
        logger.log_security_event(
            "client_deleted",
            {
                "user_id": str(current_user.id),
                "client_id": str(client_id),
                "org_id": str(db_client.org_id)
            }
        )

        return {"message": "Client deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.log_security_event(
            "client_deletion_error",
            {
                "user_id": str(current_user.id),
                "client_id": str(client_id),
                "error": str(e)
            }
        )
        raise HTTPException(status_code=500, detail="Error deleting client")