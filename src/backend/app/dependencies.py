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
from .core.security import verify_token
from .models.user import User
from .models.organization import Organization

# Initialize security logger
security_logger = SecurityLogger()

# Initialize performance monitoring
monitor = metrics.Monitor()

async def get_tenant_db(
    request: Request,
    cache_client: Cache = Depends(Cache),
    monitor: metrics.Monitor = Depends(metrics.get_monitor)
) -> AsyncGenerator[AsyncSession, None]:
    """
    Enhanced database session dependency with tenant context, validation, and monitoring.

    Args:
        request: FastAPI request object for tenant extraction
        cache_client: Cache instance for tenant validation
        monitor: Azure Monitor instance for performance tracking

    Yields:
        AsyncSession: Database session with tenant context
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
            tenant = await db.query(Organization).filter(Organization.id == tenant_id).first()
            if not tenant:
                security_logger.log_security_event(
                    "invalid_tenant_id",
                    {"tenant_id": tenant_id}
                )
                raise HTTPException(status_code=404, detail="Invalid tenant")
            
            # Cache validation result
            await cache_client.set(cache_key, True, expire=300)

    # Start monitoring
    with monitor.record_operation("database_session", {"tenant_id": tenant_id}):
        try:
            db = get_db()
            db.execute(f"SET app.tenant_id = '{tenant_id}'")
            
            security_logger.log_security_event(
                "tenant_session_created",
                {"tenant_id": tenant_id}
            )
            
            yield db
            
        except Exception as e:
            security_logger.log_security_event(
                "tenant_session_error",
                {"tenant_id": tenant_id, "error": str(e)}
            )
            raise
        finally:
            db.execute("RESET app.tenant_id")
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
    """
    cache_key = f"admin_verification:{current_user.id}"
    cached_result = await cache_client.get(cache_key)

    if not cached_result:
        # Verify admin permissions
        has_permission = await check_permissions(
            current_user,
            ["system_admin", "client_admin"],
            current_user.org_id
        )

        if not has_permission:
            security_logger.log_security_event(
                "admin_access_denied",
                {"user_id": str(current_user.id)}
            )
            raise HTTPException(
                status_code=403,
                detail="Admin access required"
            )

        # Cache verification result
        await cache_client.set(cache_key, True, expire=300)

    security_logger.log_security_event(
        "admin_access_granted",
        {"user_id": str(current_user.id)}
    )
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
    """
    # Apply rate limiting
    await rate_limiter.check_rate_limit(f"client_access:{current_user.id}")

    # Verify client permissions
    has_permission = await check_permissions(
        current_user,
        ["client_admin", "regular_user"],
        current_user.org_id
    )

    if not has_permission:
        security_logger.log_security_event(
            "client_access_denied",
            {"user_id": str(current_user.id)}
        )
        raise HTTPException(
            status_code=403,
            detail="Client access required"
        )

    security_logger.log_security_event(
        "client_access_granted",
        {"user_id": str(current_user.id)}
    )
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
    """
    cache_key = f"organization:{current_user.org_id}"
    cached_org = await cache_client.get(cache_key)

    if not cached_org:
        org = await db.query(Organization).filter(
            Organization.id == current_user.org_id
        ).first()

        if not org:
            security_logger.log_security_event(
                "organization_not_found",
                {"org_id": str(current_user.org_id)}
            )
            raise HTTPException(
                status_code=404,
                detail="Organization not found"
            )

        # Cache organization data
        await cache_client.set(cache_key, org.to_dict(), expire=300)
        return org

    return Organization(**cached_org)