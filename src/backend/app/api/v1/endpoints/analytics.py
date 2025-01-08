"""
Analytics endpoint module implementing secure, scalable analytics API routes
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
from app.utils.metrics import MetricsCollector
from app.utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix='/analytics', tags=['analytics'])

# Initialize structured logger
logger = StructuredLogger(__name__)

# Constants
CACHE_TTL = timedelta(minutes=5)
RATE_LIMIT = "100/minute"

# Response models
class AnalyticsDashboard:
    """Comprehensive analytics dashboard data model."""
    organization: Dict
    clients: Dict
    documents: Dict
    performance: Dict
    generated_at: str

@router.get('/{org_id}', 
    response_model=AnalyticsDashboard,
    summary="Get organization analytics",
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
) -> AnalyticsDashboard:
    """
    Get comprehensive analytics metrics for an organization with security validation,
    caching, and monitoring.

    Args:
        org_id: Organization ID
        start_date: Start date for metrics
        end_date: End date for metrics
        security_service: Security validation service
        cache_service: Response caching service
        monitoring_service: Request monitoring service
        analytics_service: Core analytics service

    Returns:
        AnalyticsDashboard: Comprehensive analytics dashboard data

    Raises:
        HTTPException: For invalid requests or unauthorized access
    """
    try:
        # Log analytics request
        logger.log_security_event(
            "analytics_request",
            {
                "org_id": str(org_id),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        )

        # Validate user permissions
        if not await security_service.validate_organization_access(org_id, required_scope='analytics:read'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to access organization analytics"
            )

        # Validate date range
        if start_date >= end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before end date"
            )

        if (end_date - start_date).days > 365:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Date range cannot exceed 365 days"
            )

        # Check cache for existing analytics
        cache_key = f"analytics:{org_id}:{start_date.isoformat()}:{end_date.isoformat()}"
        cached_data = await cache_service.get(cache_key)
        
        if cached_data:
            logger.debug(f"Returning cached analytics for organization {org_id}")
            monitoring_service.record_cache_hit("analytics_request")
            return cached_data

        # Get fresh analytics data
        analytics_data = await analytics_service.get_organization_metrics(
            org_id=org_id,
            start_date=start_date,
            end_date=end_date
        )

        # Cache the response
        await cache_service.set(
            key=cache_key,
            value=analytics_data,
            ttl=CACHE_TTL.total_seconds()
        )

        # Record metrics
        monitoring_service.record_operation_success("analytics_request")
        
        return analytics_data

    except HTTPException:
        raise
    except Exception as e:
        # Log error and record metric
        logger.error(f"Error retrieving analytics: {str(e)}", exc_info=True)
        monitoring_service.record_operation_failure("analytics_request")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving analytics data"
        )

@router.get('/health',
    summary="Analytics service health check",
    description="Check health status of analytics service and dependencies")
async def health_check(
    monitoring_service: MonitoringService = Depends()
) -> Dict:
    """
    Health check endpoint for analytics service monitoring.

    Args:
        monitoring_service: Request monitoring service

    Returns:
        Dict: Health status information
    """
    try:
        # Get service health metrics
        metrics = await monitoring_service.get_health_metrics()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": metrics
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analytics service health check failed"
        )