"""
FastAPI endpoint module implementing secure, scalable analytics and metrics API routes
with enhanced caching, monitoring, and role-based access control.

Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Security, status
from fastapi_limiter import RateLimiter
from fastapi_cache import Cache
from fastapi_security import SecurityService
from prometheus_fastapi_instrumentator import MonitoringService

from app.services.analytics_service import AnalyticsService
from app.services.cache_service import CacheService
from app.constants import UserRole, ErrorCode
from app.utils.metrics import MetricsCollector
from app.utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix='/analytics', tags=['analytics'])

# Initialize structured logger
logger = StructuredLogger(__name__)

# Constants
CACHE_TTL = timedelta(minutes=5)
RATE_LIMIT = "100/minute"
MAX_DATE_RANGE = timedelta(days=90)

@router.get('/{org_id}', 
    response_model=Dict,
    summary="Get organization analytics dashboard data",
    description="Retrieve comprehensive analytics metrics for an organization with caching and security")
@Security(scopes=['analytics:read'])
@RateLimiter(RATE_LIMIT)
@Cache(ttl=CACHE_TTL)
async def get_organization_analytics(
    org_id: UUID,
    start_date: datetime = Query(..., description="Start date for analytics period"),
    end_date: datetime = Query(..., description="End date for analytics period"),
    security_service: SecurityService = Depends(),
    cache_service: CacheService = Depends(),
    monitoring_service: MonitoringService = Depends(),
    analytics_service: AnalyticsService = Depends()
) -> Dict:
    """
    Get comprehensive analytics metrics for an organization with security validation,
    caching, and monitoring.

    Args:
        org_id: Organization identifier
        start_date: Start date for analytics period
        end_date: End date for analytics period
        security_service: Security validation service
        cache_service: Caching service
        monitoring_service: Monitoring and metrics service
        analytics_service: Analytics processing service

    Returns:
        Dict containing comprehensive analytics dashboard data

    Raises:
        HTTPException: For validation, authorization, or processing errors
    """
    try:
        # Validate user permissions
        user = await security_service.get_current_user()
        if not security_service.has_permission(user, org_id, [UserRole.SYSTEM_ADMIN, UserRole.CLIENT_ADMIN]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=ErrorCode.FORBIDDEN.value
            )

        # Validate date range
        if end_date < start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date must be after start date"
            )

        if end_date - start_date > MAX_DATE_RANGE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Date range cannot exceed {MAX_DATE_RANGE.days} days"
            )

        # Check cache for existing analytics
        cache_key = f"analytics:{org_id}:{start_date.isoformat()}:{end_date.isoformat()}"
        cached_result = await cache_service.get(cache_key)
        if cached_result:
            logger.debug("Returning cached analytics", 
                extra={'org_id': str(org_id), 'cache_hit': True})
            monitoring_service.increment_counter(
                'analytics_cache_hits',
                labels={'org_id': str(org_id)}
            )
            return cached_result

        # Get analytics metrics
        analytics_data = await analytics_service.get_organization_metrics(
            org_id=org_id,
            start_date=start_date,
            end_date=end_date,
            filters={
                'user_id': str(user.id),
                'client_id': str(user.client_id) if user.client_id else None
            }
        )

        # Cache the results
        await cache_service.set(
            key=cache_key,
            value=analytics_data,
            ttl=CACHE_TTL.seconds
        )

        # Track successful analytics retrieval
        monitoring_service.record_request_metric(
            'analytics_retrieval_success',
            labels={
                'org_id': str(org_id),
                'user_id': str(user.id)
            }
        )

        return analytics_data

    except HTTPException:
        raise

    except Exception as e:
        logger.error("Analytics retrieval failed",
            extra={
                'org_id': str(org_id),
                'error': str(e)
            }
        )
        monitoring_service.increment_counter(
            'analytics_retrieval_error',
            labels={
                'org_id': str(org_id),
                'error_type': type(e).__name__
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorCode.PROCESSING_ERROR.value
        )

@router.get('/health',
    response_model=Dict,
    summary="Get analytics service health metrics",
    description="Retrieve health and performance metrics for the analytics service")
@Security(scopes=['analytics:read'])
@Cache(ttl=timedelta(minutes=1))
async def get_analytics_health(
    security_service: SecurityService = Depends(),
    monitoring_service: MonitoringService = Depends()
) -> Dict:
    """
    Get health and performance metrics for the analytics service.

    Args:
        security_service: Security validation service
        monitoring_service: Monitoring and metrics service

    Returns:
        Dict containing service health metrics

    Raises:
        HTTPException: For authorization or processing errors
    """
    try:
        # Validate admin access
        user = await security_service.get_current_user()
        if not security_service.has_permission(user, None, [UserRole.SYSTEM_ADMIN]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=ErrorCode.FORBIDDEN.value
            )

        # Get service metrics
        metrics = monitoring_service.get_service_metrics()
        
        return {
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'metrics': metrics
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error("Health check failed", extra={'error': str(e)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorCode.PROCESSING_ERROR.value
        )