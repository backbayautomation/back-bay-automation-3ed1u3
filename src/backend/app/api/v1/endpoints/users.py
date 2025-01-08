"""
FastAPI router endpoints for user management with comprehensive security controls,
multi-tenant isolation, role-based access control, and detailed audit logging.

Version: 1.0.0
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status  # version: ^0.100.0
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc, asc

from ....models.user import User, UserRole
from ....schemas.user import UserCreate, UserUpdate, User as UserSchema
from ....core.security import get_password_hash, verify_password
from ....utils.logging import StructuredLogger
from ....db.session import get_db
from ....core.auth import get_current_user, check_user_permissions
from ....utils.pagination import PaginatedResponse, paginate_query

# Initialize router with prefix and tags
router = APIRouter(prefix="/users", tags=["users"])

# Initialize structured logger
logger = StructuredLogger(__name__)

@router.get("/", response_model=PaginatedResponse[UserSchema])
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    sort_by: str = Query("created_at", regex="^(email|full_name|role|created_at)$"),
    descending: bool = Query(True),
    org_id: Optional[UUID] = None,
    client_id: Optional[UUID] = None
) -> PaginatedResponse[UserSchema]:
    """
    Retrieve paginated list of users with filtering and sorting capabilities.
    Implements multi-tenant isolation and role-based access control.
    """
    try:
        # Check user permissions
        if not check_user_permissions(current_user, ["SYSTEM_ADMIN", "CLIENT_ADMIN"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to list users"
            )

        # Build base query with tenant isolation
        query = db.query(User)
        
        # Apply tenant filtering
        if current_user.role != UserRole.SYSTEM_ADMIN:
            query = query.filter(User.org_id == current_user.org_id)
            if current_user.client_id:
                query = query.filter(User.client_id == current_user.client_id)
        elif org_id:
            query = query.filter(User.org_id == org_id)
            if client_id:
                query = query.filter(User.client_id == client_id)

        # Apply sorting
        sort_column = getattr(User, sort_by)
        query = query.order_by(desc(sort_column) if descending else asc(sort_column))

        # Get paginated results
        paginated_users = paginate_query(query, skip, limit)

        # Log successful retrieval
        logger.log_security_event(
            "user_list_accessed",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "filters": {"org_id": org_id, "client_id": client_id},
                "count": paginated_users.total
            }
        )

        return paginated_users

    except Exception as e:
        # Log error
        logger.log_security_event(
            "error_user_list_access",
            {
                "user_id": str(current_user.id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )

@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_create: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Create new user with role-based access control and multi-tenant isolation.
    Implements comprehensive security controls and audit logging.
    """
    try:
        # Check user permissions
        if not check_user_permissions(current_user, ["SYSTEM_ADMIN", "CLIENT_ADMIN"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create users"
            )

        # Validate tenant access
        if current_user.role != UserRole.SYSTEM_ADMIN:
            if user_create.org_id != current_user.org_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot create user for different organization"
                )
            if current_user.client_id and user_create.client_id != current_user.client_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot create user for different client"
                )

        # Check if email already exists
        if db.query(User).filter(User.email == user_create.email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Create new user instance
        new_user = User(
            email=user_create.email,
            org_id=user_create.org_id,
            client_id=user_create.client_id,
            role=user_create.role,
            full_name=user_create.full_name,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Set password with secure hashing
        new_user.hashed_password = get_password_hash(user_create.password)

        # Save to database
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Log user creation
        logger.log_security_event(
            "user_created",
            {
                "created_by": str(current_user.id),
                "new_user_id": str(new_user.id),
                "org_id": str(new_user.org_id),
                "client_id": str(new_user.client_id) if new_user.client_id else None,
                "role": new_user.role
            }
        )

        return new_user

    except IntegrityError as e:
        db.rollback()
        logger.log_security_event(
            "error_user_create",
            {
                "created_by": str(current_user.id),
                "error": "Database integrity error",
                "details": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Database integrity error"
        )
    except Exception as e:
        db.rollback()
        logger.log_security_event(
            "error_user_create",
            {
                "created_by": str(current_user.id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )