"""
Health check endpoints for the AI-powered Product Catalog Search System.
Provides comprehensive system monitoring, component health checks, and Kubernetes probes.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Depends, status  # version: ^0.103.0
import time
from typing import Dict, Any

from ../../services.cache_service import CacheService
from ../../db.session import get_db
from ../../core.config import Settings

# Initialize router with health check endpoints
router = APIRouter(tags=['health'], prefix='/health')

# Performance thresholds
CACHE_THRESHOLD_MS = 100  # Maximum acceptable cache response time
DB_THRESHOLD_MS = 200     # Maximum acceptable database response time

async def check_database(db=Depends(get_db)) -> Dict[str, Any]:
    """
    Performs comprehensive database health check including connection pool status,
    query performance, and resource utilization.
    """
    start_time = time.time()
    try:
        # Execute simple query to verify database connection
        db.execute("SELECT 1")
        
        # Get connection pool metrics
        pool_stats = db.monitor_pool_health()
        response_time = (time.time() - start_time) * 1000

        # Verify metrics against thresholds
        status_ok = (
            response_time <= DB_THRESHOLD_MS and
            pool_stats['checkedout'] / pool_stats['pool_size'] <= 0.8
        )

        return {
            'status': 'healthy' if status_ok else 'degraded',
            'response_time_ms': round(response_time, 2),
            'pool_stats': pool_stats,
            'connections': {
                'active': pool_stats['checkedout'],
                'available': pool_stats['pool_size'] - pool_stats['checkedout'],
                'max_size': pool_stats['pool_size']
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(e)}"
        )

async def check_cache() -> Dict[str, Any]:
    """
    Performs detailed Redis cache service health check with performance metrics
    and threshold monitoring.
    """
    start_time = time.time()
    try:
        # Get cache service instance
        cache_service = CacheService()
        
        # Check connectivity and get metrics
        stats = await cache_service.get_stats()
        response_time = (time.time() - start_time) * 1000

        # Verify metrics against thresholds
        status_ok = (
            response_time <= CACHE_THRESHOLD_MS and
            stats['hit_ratio'] >= 0.8 and
            stats['errors'] / (stats['hits'] + stats['misses'] + 1) <= 0.01
        )

        return {
            'status': 'healthy' if status_ok else 'degraded',
            'response_time_ms': round(response_time, 2),
            'metrics': {
                'hit_ratio': round(stats['hit_ratio'], 2),
                'memory_used_mb': round(stats['memory_used_bytes'] / 1024 / 1024, 2),
                'memory_peak_mb': round(stats['memory_peak_bytes'] / 1024 / 1024, 2),
                'connected_clients': stats['connected_clients'],
                'uptime_hours': round(stats['uptime_seconds'] / 3600, 2)
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cache health check failed: {str(e)}"
        )

@router.get('/', status_code=status.HTTP_200_OK)
async def get_health(db=Depends(get_db)) -> Dict[str, Any]:
    """
    Comprehensive health check endpoint aggregating all component statuses
    with detailed metrics.
    """
    start_time = time.time()
    
    try:
        # Check all critical components
        db_health = await check_database(db)
        cache_health = await check_cache()
        
        # Calculate overall system health
        system_healthy = (
            db_health['status'] == 'healthy' and
            cache_health['status'] == 'healthy'
        )

        response_time = (time.time() - start_time) * 1000

        return {
            'status': 'healthy' if system_healthy else 'degraded',
            'response_time_ms': round(response_time, 2),
            'timestamp': time.time(),
            'components': {
                'database': db_health,
                'cache': cache_health
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Health check failed: {str(e)}"
        )

@router.get('/ready', status_code=status.HTTP_200_OK)
async def get_readiness() -> Dict[str, str]:
    """
    Enhanced Kubernetes readiness probe with comprehensive service availability checks.
    """
    try:
        # Verify critical service initialization
        cache_service = CacheService()
        await cache_service.check_connectivity()
        
        return {
            'status': 'ready',
            'message': 'Application is ready to accept traffic'
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Application not ready: {str(e)}"
        )

@router.get('/live', status_code=status.HTTP_200_OK)
async def get_liveness() -> Dict[str, str]:
    """
    Kubernetes liveness probe for basic application health check.
    """
    return {
        'status': 'alive',
        'message': 'Application is running'
    }