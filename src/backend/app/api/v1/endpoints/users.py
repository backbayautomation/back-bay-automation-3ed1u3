"""
FastAPI router endpoints for user management with comprehensive security controls,
multi-tenant isolation, role-based access control, and detailed audit logging.

Version: 1.0.0
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from redis import Redis  # version: 4.5.0
from slowapi import Limiter  # version: 0.1.8
from slowapi.util import get_remote_address

from ....models.user import User, UserRole
from ....schemas.user import UserCreate, UserUpdate, User as UserSchema
from ....utils.logging import StructuredLogger
from ....core.security import verify_password, get_password_hash
from ....db.session import get_db
from ....core.auth import get_current_user, check_permissions

# Initialize router with prefix and tags
router = APIRouter(prefix="/users", tags=["users"])

# Initialize structured logger
logger = StructuredLogger(__name__)

# Initialize rate limiter
redis_client = Redis(host="localhost", port=6379, db=0)
limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")

@router.get("/", response_model=List[UserSchema])
@limiter.limit("100/minute")
async def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    sort_by: str = Query("created_at", regex="^(email|full_name|role|created_at)$"),
    descending: bool = Query(True),
    org_id: Optional[UUID] = None,
    client_id: Optional[UUID] = None,
) -> List[UserSchema]:
    """
    Retrieve paginated list of users with filtering and sorting capabilities.
    Implements multi-tenant isolation and role-based access control.
    """
    try:
        # Check permissions
        if not check_permissions(current_user, ["SYSTEM_ADMIN", "CLIENT_ADMIN"]):
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

        # Apply pagination
        users = query.offset(skip).limit(limit).all()

        # Log access
        logger.log_security_event(
            "user_list_access",
            {
                "user_id": str(current_user.id),
                "org_id": str(current_user.org_id),
                "client_id": str(current_user.client_id) if current_user.client_id else None,
                "results_count": len(users)
            }
        )

        return users

    except Exception as e:
        logger.log_security_event(
            "user_list_error",
            {
                "user_id": str(current_user.id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving users"
        )

@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
@limiter.limit("50/hour")
async def create_user(
    user_create: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> UserSchema:
    """
    Create new user with role-based access control and multi-tenant isolation.
    Implements comprehensive security controls and audit logging.
    """
    try:
        # Check permissions
        if not check_permissions(current_user, ["SYSTEM_ADMIN", "CLIENT_ADMIN"]):
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
        user.set_password(user_create.password)

        # Save to database
        db.add(user)
        db.commit()
        db.refresh(user)

        # Log user creation
        logger.log_security_event(
            "user_created",
            {
                "created_by": str(current_user.id),
                "new_user_id": str(user.id),
                "org_id": str(user.org_id),
                "client_id": str(user.client_id) if user.client_id else None,
                "role": user.role
            }
        )

        return user

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.log_security_event(
            "user_creation_error",
            {
                "created_by": str(current_user.id),
                "error": str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )