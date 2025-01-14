"""
FastAPI router endpoints for secure user management with multi-tenant isolation,
role-based access control, and comprehensive audit logging.

Version: 1.0.0
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status  # version: ^0.100.0
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc, asc

from ....db.session import get_db
from ....models.user import User, UserRole
from ....schemas.user import UserCreate, UserUpdate, User as UserSchema
from ....core.security import (
    get_current_user,
    verify_password,
    get_password_hash,
    check_rate_limit
)
from ....utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/users", tags=["users"])

# Initialize structured logger
logger = StructuredLogger(__name__)

@router.get("/", response_model=List[UserSchema])
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("created_at", regex="^(email|full_name|role|created_at)$"),
    descending: bool = Query(True),
    org_id: Optional[UUID] = None,
    client_id: Optional[UUID] = None
) -> List[UserSchema]:
    """
    Retrieve paginated list of users with multi-tenant isolation and RBAC.
    
    Args:
        db: Database session
        current_user: Authenticated user making the request
        skip: Number of records to skip
        limit: Maximum number of records to return
        sort_by: Field to sort results by
        descending: Sort in descending order if True
        org_id: Optional organization filter
        client_id: Optional client filter
        
    Returns:
        List[UserSchema]: List of users matching criteria
        
    Raises:
        HTTPException: For authorization or validation errors
    """
    try:
        # Check rate limit
        if not check_rate_limit("get_users", str(current_user.id)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded for user listing"
            )

        # Verify permissions
        if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.CLIENT_ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to list users"
            )

        # Build base query with tenant isolation
        query = db.query(User)
        
        # Apply tenant filtering
        if current_user.role == UserRole.CLIENT_ADMIN:
            query = query.filter(User.client_id == current_user.client_id)
        elif org_id:
            query = query.filter(User.org_id == org_id)
        if client_id:
            query = query.filter(User.client_id == client_id)

        # Apply sorting
        sort_column = getattr(User, sort_by)
        query = query.order_by(desc(sort_column) if descending else asc(sort_column))

        # Apply pagination
        users = query.offset(skip).limit(limit).all()

        # Log successful retrieval
        logger.log_security_event(
            "user_list_accessed",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(current_user.client_id) if current_user.client_id else None,
                "records_returned": len(users)
            }
        )

        return [UserSchema.from_orm(user) for user in users]

    except HTTPException:
        raise
    except Exception as e:
        logger.log_security_event(
            "user_list_error",
            {
                "error": str(e),
                "user_id": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while retrieving users"
        )

@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_create: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> UserSchema:
    """
    Create new user with role-based access control and tenant isolation.
    
    Args:
        user_create: User creation data
        db: Database session
        current_user: Authenticated user making the request
        
    Returns:
        UserSchema: Created user details
        
    Raises:
        HTTPException: For authorization or validation errors
    """
    try:
        # Check rate limit
        if not check_rate_limit("create_user", str(current_user.id)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded for user creation"
            )

        # Verify permissions
        if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.CLIENT_ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create users"
            )

        # Verify tenant access
        if current_user.role == UserRole.CLIENT_ADMIN:
            if user_create.org_id != current_user.org_id or user_create.client_id != current_user.client_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot create user for different organization/client"
                )

        # Check email uniqueness
        if db.query(User).filter(User.email == user_create.email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Create user instance
        user = User(
            email=user_create.email,
            full_name=user_create.full_name,
            role=user_create.role,
            org_id=user_create.org_id,
            client_id=user_create.client_id
        )
        
        # Set password with validation
        user.set_password(user_create.password)

        # Save to database
        db.add(user)
        db.commit()
        db.refresh(user)

        # Log user creation
        logger.log_security_event(
            "user_created",
            {
                "created_user_id": str(user.id),
                "created_by": str(current_user.id),
                "org_id": str(user.org_id),
                "client_id": str(user.client_id) if user.client_id else None,
                "role": user.role.value
            }
        )

        return UserSchema.from_orm(user)

    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.log_security_event(
            "user_creation_error",
            {
                "error": "Database integrity error",
                "details": str(e),
                "attempted_by": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error during user creation"
        )
    except Exception as e:
        db.rollback()
        logger.log_security_event(
            "user_creation_error",
            {
                "error": str(e),
                "attempted_by": str(current_user.id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during user creation"
        )