"""
FastAPI router endpoints for client management in the multi-tenant system.
Implements secure CRUD operations with role-based access control, pagination,
filtering, audit logging, and comprehensive error handling.

Version: 1.0.0
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends, Query, Path, BackgroundTasks
from fastapi_limiter import RateLimiter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from sqlalchemy.orm import joinedload

from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate, Client as ClientSchema
from app.core.auth import get_current_active_user, check_permissions
from app.db.session import get_db
from app.utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/clients", tags=["clients"])

# Initialize structured logger for client operations
logger = StructuredLogger(__name__)

# Rate limiting configuration
rate_limit_config = {"rate": 100, "period": 3600}  # 100 requests per hour

@router.get("/", response_model=List[ClientSchema])
async def get_clients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    name: Optional[str] = Query(None, description="Filter by client name"),
    sort_by: Optional[str] = Query("name", description="Sort field"),
    sort_order: Optional[str] = Query("asc", description="Sort direction"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of records to return"),
    _: bool = Depends(RateLimiter(times=rate_limit_config["rate"], seconds=rate_limit_config["period"]))
) -> List[ClientSchema]:
    """
    Retrieve paginated and filtered list of clients with role-based access control.
    
    Args:
        db: Database session
        current_user: Authenticated user
        name: Optional name filter
        sort_by: Field to sort by
        sort_order: Sort direction (asc/desc)
        skip: Pagination offset
        limit: Pagination limit
        
    Returns:
        List[ClientSchema]: List of client objects
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Verify user permissions
        if not await check_permissions(current_user, ["system_admin", "client_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Build base query
        query = select(Client).options(joinedload(Client.organization))

        # Apply tenant isolation for non-system admins
        if current_user.role != "system_admin":
            query = query.filter(Client.org_id == current_user.org_id)

        # Apply name filter if provided
        if name:
            query = query.filter(Client.name.ilike(f"%{name}%"))

        # Apply sorting
        sort_column = getattr(Client, sort_by, Client.name)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))

        # Execute query with pagination
        result = await db.execute(query.offset(skip).limit(limit))
        clients = result.scalars().all()

        # Log successful retrieval
        logger.log_metric("clients_retrieved", len(clients), {
            "user_id": str(current_user.id),
            "org_id": str(current_user.org_id)
        })

        return [ClientSchema.from_orm(client) for client in clients]

    except Exception as e:
        logger.log_security_event("client_list_error", {
            "error": str(e),
            "user_id": str(current_user.id)
        })
        raise HTTPException(status_code=500, detail="Error retrieving clients")

@router.get("/{client_id}", response_model=ClientSchema)
async def get_client(
    client_id: UUID = Path(..., description="Client ID to retrieve"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: bool = Depends(RateLimiter(times=rate_limit_config["rate"], seconds=rate_limit_config["period"]))
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
        # Verify user permissions
        if not await check_permissions(current_user, ["system_admin", "client_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Query client with organization
        query = select(Client).options(joinedload(Client.organization)).filter(Client.id == client_id)
        
        # Apply tenant isolation
        if current_user.role != "system_admin":
            query = query.filter(Client.org_id == current_user.org_id)

        result = await db.execute(query)
        client = result.scalar_one_or_none()

        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        # Log successful retrieval
        logger.log_security_event("client_retrieved", {
            "client_id": str(client_id),
            "user_id": str(current_user.id)
        })

        return ClientSchema.from_orm(client)

    except HTTPException:
        raise
    except Exception as e:
        logger.log_security_event("client_retrieval_error", {
            "error": str(e),
            "client_id": str(client_id),
            "user_id": str(current_user.id)
        })
        raise HTTPException(status_code=500, detail="Error retrieving client")

@router.post("/", response_model=ClientSchema)
async def create_client(
    client_data: ClientCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: bool = Depends(RateLimiter(times=rate_limit_config["rate"], seconds=rate_limit_config["period"]))
) -> ClientSchema:
    """
    Create a new client with security validation and audit logging.
    
    Args:
        client_data: Client creation data
        background_tasks: Background task handler
        db: Database session
        current_user: Authenticated user
        
    Returns:
        ClientSchema: Created client details
        
    Raises:
        HTTPException: For authorization or validation errors
    """
    try:
        # Verify user permissions
        if not await check_permissions(current_user, ["system_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Create new client
        new_client = Client(
            org_id=client_data.org_id,
            name=client_data.name,
            config=client_data.config,
            branding=client_data.branding
        )

        db.add(new_client)
        await db.commit()
        await db.refresh(new_client)

        # Schedule background tasks
        background_tasks.add_task(
            logger.log_security_event,
            "client_created",
            {
                "client_id": str(new_client.id),
                "org_id": str(client_data.org_id),
                "created_by": str(current_user.id)
            }
        )

        return ClientSchema.from_orm(new_client)

    except Exception as e:
        await db.rollback()
        logger.log_security_event("client_creation_error", {
            "error": str(e),
            "user_id": str(current_user.id)
        })
        raise HTTPException(status_code=500, detail="Error creating client")

@router.put("/{client_id}", response_model=ClientSchema)
async def update_client(
    client_id: UUID,
    client_data: ClientUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: bool = Depends(RateLimiter(times=rate_limit_config["rate"], seconds=rate_limit_config["period"]))
) -> ClientSchema:
    """
    Update an existing client with validation and audit logging.
    
    Args:
        client_id: UUID of client to update
        client_data: Client update data
        background_tasks: Background task handler
        db: Database session
        current_user: Authenticated user
        
    Returns:
        ClientSchema: Updated client details
        
    Raises:
        HTTPException: For authorization or validation errors
    """
    try:
        # Verify user permissions
        if not await check_permissions(current_user, ["system_admin", "client_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Query existing client
        query = select(Client).filter(Client.id == client_id)
        if current_user.role != "system_admin":
            query = query.filter(Client.org_id == current_user.org_id)

        result = await db.execute(query)
        client = result.scalar_one_or_none()

        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        # Update client fields
        if client_data.name is not None:
            client.name = client_data.name
        if client_data.config is not None:
            client.update_config(client_data.config)
        if client_data.branding is not None:
            client.update_branding(client_data.branding)

        await db.commit()
        await db.refresh(client)

        # Schedule audit logging
        background_tasks.add_task(
            logger.log_security_event,
            "client_updated",
            {
                "client_id": str(client_id),
                "updated_by": str(current_user.id),
                "changes": client_data.dict(exclude_unset=True)
            }
        )

        return ClientSchema.from_orm(client)

    except Exception as e:
        await db.rollback()
        logger.log_security_event("client_update_error", {
            "error": str(e),
            "client_id": str(client_id),
            "user_id": str(current_user.id)
        })
        raise HTTPException(status_code=500, detail="Error updating client")

@router.delete("/{client_id}")
async def delete_client(
    client_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: bool = Depends(RateLimiter(times=rate_limit_config["rate"], seconds=rate_limit_config["period"]))
) -> dict:
    """
    Delete a client with security validation and cascade handling.
    
    Args:
        client_id: UUID of client to delete
        background_tasks: Background task handler
        db: Database session
        current_user: Authenticated user
        
    Returns:
        dict: Deletion confirmation
        
    Raises:
        HTTPException: For authorization or database errors
    """
    try:
        # Verify user permissions
        if not await check_permissions(current_user, ["system_admin"], current_user.org_id):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        # Query client
        query = select(Client).filter(Client.id == client_id)
        result = await db.execute(query)
        client = result.scalar_one_or_none()

        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        # Store client data for audit log
        client_data = client.to_dict()

        # Delete client (cascade will handle related records)
        await db.delete(client)
        await db.commit()

        # Schedule audit logging
        background_tasks.add_task(
            logger.log_security_event,
            "client_deleted",
            {
                "client_id": str(client_id),
                "deleted_by": str(current_user.id),
                "client_data": client_data
            }
        )

        return {"message": "Client deleted successfully"}

    except Exception as e:
        await db.rollback()
        logger.log_security_event("client_deletion_error", {
            "error": str(e),
            "client_id": str(client_id),
            "user_id": str(current_user.id)
        })
        raise HTTPException(status_code=500, detail="Error deleting client")