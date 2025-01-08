"""
Centralized FastAPI dependency injection module implementing secure, monitored,
and cached dependencies for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi_cache import Cache  # version: 0.1.0
from fastapi_limiter import RateLimiter  # version: 0.1.5
from azure.monitor import metrics  # version: 5.0.0
from security_logging import SecurityLogger  # version: 1.0.0

from .db.session import get_db
from .core.auth import get_current_user, get_current_active_user, check_permissions
from .utils.logging import StructuredLogger
from .models.user import User
from .models.organization import Organization

# Initialize components
logger = StructuredLogger(__name__)
security_logger = SecurityLogger()
monitor = metrics.Monitor()

async def get_tenant_db(
    request: Request,
    cache_client: Cache = Depends(Cache),
    monitor: metrics.Monitor = Depends(metrics.Monitor)
) -> AsyncGenerator[AsyncSession, None]:
    """
    Enhanced database session dependency with tenant isolation, monitoring,
    and caching capabilities.
    """
    session_start = monitor.start_operation("database_session")
    
    try:
        # Extract and validate tenant ID
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            security_logger.log_security_event(
                "missing_tenant_id",
                {"path": request.url.path, "method": request.method}
            )
            raise HTTPException(status_code=400, detail="Tenant ID required")

        # Check tenant cache
        cache_key = f"tenant_validation:{tenant_id}"
        if not await cache_client.get(cache_key):
            # Validate tenant existence and status
            async with get_db() as db:
                tenant = await db.query(Organization).filter(
                    Organization.id == tenant_id,
                    Organization.is_active == True
                ).first()
                
                if not tenant:
                    security_logger.log_security_event(
                        "invalid_tenant_id",
                        {"tenant_id": tenant_id}
                    )
                    raise HTTPException(status_code=403, detail="Invalid tenant")
                
                # Cache successful validation
                await cache_client.set(cache_key, True, expire=300)

        # Get database session with tenant context
        async with get_db() as session:
            # Set tenant context
            await session.execute("SET app.current_tenant = :tenant_id", {"tenant_id": tenant_id})
            
            # Monitor session metrics
            monitor.track_metric("active_db_sessions", 1)
            
            try:
                yield session
            finally:
                monitor.track_metric("active_db_sessions", -1)
                session_start.complete()

    except Exception as e:
        security_logger.log_security_event(
            "session_error",
            {"error": str(e), "tenant_id": tenant_id if tenant_id else None}
        )
        session_start.fail()
        raise

async def verify_admin_access(
    current_user: User = Depends(get_current_active_user),
    cache_client: Cache = Depends(Cache),
    security_logger: SecurityLogger = Depends(SecurityLogger)
) -> User:
    """
    Enhanced admin role verification with caching and security logging.
    """
    cache_key = f"admin_verification:{current_user.id}"
    
    try:
        # Check cache first
        if not await cache_client.get(cache_key):
            # Verify admin permissions
            has_permission = await check_permissions(
                current_user,
                ["system_admin", "client_admin"],
                current_user.org_id
            )
            
            if not has_permission:
                security_logger.log_security_event(
                    "unauthorized_admin_access",
                    {"user_id": str(current_user.id), "role": current_user.role}
                )
                raise HTTPException(
                    status_code=403,
                    detail="Admin access required"
                )
            
            # Cache successful verification
            await cache_client.set(cache_key, True, expire=300)
        
        return current_user

    except Exception as e:
        security_logger.log_security_event(
            "admin_verification_error",
            {"error": str(e), "user_id": str(current_user.id)}
        )
        raise

async def verify_client_access(
    current_user: User = Depends(get_current_active_user),
    rate_limiter: RateLimiter = Depends(RateLimiter),
    security_logger: SecurityLogger = Depends(SecurityLogger)
) -> User:
    """
    Enhanced client role verification with rate limiting and security tracking.
    """
    try:
        # Apply rate limiting
        await rate_limiter.check(f"client_access:{current_user.id}")
        
        # Verify client permissions
        has_permission = await check_permissions(
            current_user,
            ["regular_user", "power_user"],
            current_user.org_id
        )
        
        if not has_permission:
            security_logger.log_security_event(
                "unauthorized_client_access",
                {"user_id": str(current_user.id), "role": current_user.role}
            )
            raise HTTPException(
                status_code=403,
                detail="Client access required"
            )
        
        return current_user

    except Exception as e:
        security_logger.log_security_event(
            "client_verification_error",
            {"error": str(e), "user_id": str(current_user.id)}
        )
        raise

async def get_current_organization(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_tenant_db),
    cache_client: Cache = Depends(Cache)
) -> Organization:
    """
    Enhanced organization context retrieval with caching and validation.
    """
    cache_key = f"organization:{current_user.org_id}"
    
    try:
        # Check cache first
        organization = await cache_client.get(cache_key)
        if not organization:
            # Query organization with validation
            organization = await db.query(Organization).filter(
                Organization.id == current_user.org_id,
                Organization.is_active == True
            ).first()
            
            if not organization:
                raise HTTPException(
                    status_code=404,
                    detail="Organization not found"
                )
            
            # Cache organization data
            await cache_client.set(cache_key, organization, expire=300)
        
        return organization

    except Exception as e:
        security_logger.log_security_event(
            "organization_retrieval_error",
            {"error": str(e), "org_id": str(current_user.org_id)}
        )
        raise