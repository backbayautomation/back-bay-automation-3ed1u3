"""
FastAPI dependency injection module implementing secure, monitored, and cached dependencies
for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, Request  # version: ^0.100.0
from sqlalchemy.ext.asyncio import AsyncSession  # version: ^1.4.0
from fastapi_cache import Cache  # version: ^0.1.0
from fastapi_limiter import RateLimiter  # version: ^0.1.5
from azure.monitor import metrics  # version: ^5.0.0
from security_logging import SecurityLogger  # version: ^1.0.0

from .db.session import get_db
from .core.auth import get_current_user, get_current_active_user, check_permissions
from .models.user import User
from .models.organization import Organization
from .utils.logging import StructuredLogger

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
    Enhanced database session with tenant context, validation, and monitoring.
    
    Args:
        request: FastAPI request object for tenant extraction
        cache_client: Cache instance for tenant validation
        monitor: Azure Monitor instance for performance tracking
        
    Yields:
        AsyncSession: Database session with tenant context
        
    Raises:
        HTTPException: If tenant validation fails
    """
    tenant_id = request.headers.get("X-Tenant-ID")
    if not tenant_id:
        security_logger.log_security_event(
            "missing_tenant_id",
            {"path": request.url.path}
        )
        raise HTTPException(status_code=400, detail="Tenant ID required")

    # Check tenant cache
    cache_key = f"tenant_validation:{tenant_id}"
    if not await cache_client.get(cache_key):
        # Validate tenant exists
        async with get_db() as db:
            tenant = await db.execute(
                "SELECT id FROM organizations WHERE id = :tenant_id",
                {"tenant_id": tenant_id}
            )
            if not tenant.scalar():
                security_logger.log_security_event(
                    "invalid_tenant_id",
                    {"tenant_id": tenant_id}
                )
                raise HTTPException(status_code=404, detail="Invalid tenant")
            
            # Cache validation result
            await cache_client.set(cache_key, "valid", expire=300)

    # Start monitoring
    with monitor.record_operation_time("database_session"):
        try:
            db = get_db()
            # Set tenant context
            await db.execute("SET app.current_tenant = :tenant_id", {"tenant_id": tenant_id})
            
            yield db
            
        except Exception as e:
            security_logger.log_security_event(
                "database_session_error",
                {"tenant_id": tenant_id, "error": str(e)}
            )
            raise HTTPException(status_code=500, detail="Database error")
        finally:
            await db.execute("RESET app.current_tenant")
            await db.close()

async def verify_admin_access(
    current_user: User = Depends(get_current_active_user),
    cache_client: Cache = Depends(Cache),
    security_logger: SecurityLogger = Depends(SecurityLogger)
) -> User:
    """
    Enhanced admin role verification with caching and audit logging.
    
    Args:
        current_user: Current authenticated user
        cache_client: Cache instance for permission caching
        security_logger: Security logger for audit events
        
    Returns:
        User: Verified admin user
        
    Raises:
        HTTPException: If admin access verification fails
    """
    cache_key = f"admin_verification:{current_user.id}"
    cached_result = await cache_client.get(cache_key)

    if not cached_result:
        # Verify admin permissions
        has_permission = await check_permissions(
            current_user,
            ["system_admin", "client_admin"],
            str(current_user.org_id)
        )
        
        if not has_permission:
            security_logger.log_security_event(
                "admin_access_denied",
                {"user_id": str(current_user.id)}
            )
            raise HTTPException(status_code=403, detail="Admin access required")
            
        # Cache verification result
        await cache_client.set(cache_key, "verified", expire=300)
    
    return current_user

async def verify_client_access(
    current_user: User = Depends(get_current_active_user),
    rate_limiter: RateLimiter = Depends(RateLimiter),
    security_logger: SecurityLogger = Depends(SecurityLogger)
) -> User:
    """
    Enhanced client role verification with rate limiting and security tracking.
    
    Args:
        current_user: Current authenticated user
        rate_limiter: Rate limiter instance
        security_logger: Security logger for audit events
        
    Returns:
        User: Verified client user
        
    Raises:
        HTTPException: If client access verification fails
    """
    # Apply rate limiting
    if not await rate_limiter.check(f"client_access:{current_user.id}"):
        security_logger.log_security_event(
            "rate_limit_exceeded",
            {"user_id": str(current_user.id)}
        )
        raise HTTPException(status_code=429, detail="Too many requests")

    # Verify client permissions
    has_permission = await check_permissions(
        current_user,
        ["regular_user", "client_admin"],
        str(current_user.org_id)
    )
    
    if not has_permission:
        security_logger.log_security_event(
            "client_access_denied",
            {"user_id": str(current_user.id)}
        )
        raise HTTPException(status_code=403, detail="Client access required")

    return current_user

async def get_current_organization(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_tenant_db),
    cache_client: Cache = Depends(Cache)
) -> Organization:
    """
    Enhanced organization context retrieval with caching and validation.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        cache_client: Cache instance
        
    Returns:
        Organization: Current organization
        
    Raises:
        HTTPException: If organization retrieval fails
    """
    cache_key = f"organization:{current_user.org_id}"
    cached_org = await cache_client.get(cache_key)

    if not cached_org:
        # Query organization with validation
        query = """
            SELECT o.* FROM organizations o
            WHERE o.id = :org_id
        """
        result = await db.execute(query, {"org_id": current_user.org_id})
        org = result.first()

        if not org:
            security_logger.log_security_event(
                "organization_not_found",
                {"org_id": str(current_user.org_id)}
            )
            raise HTTPException(status_code=404, detail="Organization not found")

        # Cache organization data
        await cache_client.set(cache_key, org, expire=300)
        return org

    return cached_org