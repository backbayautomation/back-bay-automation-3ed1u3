"""
Analytics endpoints module implementing secure, scalable API routes for retrieving
analytics and metrics data with enhanced caching and monitoring.

Version: 1.0.0
"""

# External imports
from fastapi import APIRouter, Depends, HTTPException, Query, Security  # version: 0.103.0
from fastapi_limiter import RateLimiter  # version: 0.1.5
from fastapi_cache import Cache  # version: 0.1.0
from fastapi_security import SecurityService  # version: 0.5.0
from prometheus_fastapi_instrumentator import MonitoringService  # version: 5.9.1
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging

# Internal imports
from app.services.analytics_service import AnalyticsService
from app.services.cache_service import CacheService
from app.constants import UserRole, ErrorCode
from app.utils.logging import StructuredLogger

# Initialize router with prefix and tags
router = APIRouter(prefix='/analytics', tags=['analytics'])

# Initialize logger
logger = StructuredLogger(__name__)

# Constants
CACHE_TTL = timedelta(minutes=5)
RATE_LIMIT = "100/minute"

@router.get('/{org_id}', response_model=Dict)
@Security(scopes=['analytics:read'])
@RateLimiter(RATE_LIMIT)
@Cache(ttl=CACHE_TTL)
async def get_organization_analytics(
    org_id: str,
    start_date: datetime = Query(..., description="Start date for analytics period"),
    end_date: datetime = Query(..., description="End date for analytics period"),
    security_service: SecurityService = Depends(),
    cache_service: CacheService = Depends(),
    monitoring_service: MonitoringService = Depends(),
    analytics_service: AnalyticsService = Depends()
) -> Dict:
    """
    Get comprehensive analytics metrics for an organization with enhanced security,
    caching, and monitoring.

    Args:
        org_id: Organization ID to retrieve analytics for
        start_date: Start date for analytics period
        end_date: End date for analytics period
        security_service: Security validation service
        cache_service: Caching service for response optimization
        monitoring_service: Monitoring service for metrics tracking
        analytics_service: Core analytics service

    Returns:
        Dict containing detailed analytics dashboard data

    Raises:
        HTTPException: For various error conditions with appropriate status codes
    """
    try:
        # Validate user permissions
        user = await security_service.get_current_user()
        if not security_service.has_organization_access(user, org_id):
            logger.log_security_event(
                "unauthorized_analytics_access",
                {"user_id": user.id, "org_id": org_id}
            )
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions to access organization analytics"
            )

        # Validate date range
        if end_date <= start_date:
            raise HTTPException(
                status_code=400,
                detail="End date must be after start date"
            )

        # Check cache for existing analytics
        cache_key = f"analytics:{org_id}:{start_date.isoformat()}:{end_date.isoformat()}"
        cached_analytics = await cache_service.get(cache_key)
        if cached_analytics:
            monitoring_service.increment_counter(
                "analytics_cache_hits",
                labels={"org_id": org_id}
            )
            return cached_analytics

        # Record analytics request
        monitoring_service.record_request_start(
            "get_organization_analytics",
            labels={"org_id": org_id}
        )

        # Get organization metrics
        metrics = await analytics_service.get_organization_metrics(
            org_id=org_id,
            start_date=start_date,
            end_date=end_date
        )

        # Format response data
        response = {
            "organization": {
                "id": org_id,
                "analytics_period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            },
            "metrics": metrics,
            "generated_at": datetime.utcnow().isoformat()
        }

        # Cache response
        await cache_service.set(
            cache_key,
            response,
            ttl=CACHE_TTL.total_seconds()
        )

        # Record successful request
        monitoring_service.record_request_end(
            "get_organization_analytics",
            labels={"org_id": org_id, "status": "success"}
        )

        return response

    except HTTPException:
        raise

    except Exception as e:
        # Log error and record failure metric
        logger.error(
            "Failed to retrieve organization analytics",
            extra={
                "org_id": org_id,
                "error": str(e),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
        )
        monitoring_service.record_request_end(
            "get_organization_analytics",
            labels={"org_id": org_id, "status": "error"}
        )
        raise HTTPException(
            status_code=500,
            detail="Internal server error retrieving analytics"
        )

@router.get('/health', include_in_schema=False)
async def health_check(
    monitoring_service: MonitoringService = Depends()
) -> Dict:
    """
    Health check endpoint for analytics service monitoring.

    Args:
        monitoring_service: Monitoring service for health metrics

    Returns:
        Dict containing health status and metrics
    """
    try:
        # Record health check
        monitoring_service.increment_counter(
            "analytics_health_checks",
            labels={"status": "success"}
        )
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        # Log error and record failure
        logger.error(
            "Analytics health check failed",
            extra={"error": str(e)}
        )
        monitoring_service.increment_counter(
            "analytics_health_checks",
            labels={"status": "error"}
        )
        raise HTTPException(
            status_code=500,
            detail="Analytics service health check failed"
        )