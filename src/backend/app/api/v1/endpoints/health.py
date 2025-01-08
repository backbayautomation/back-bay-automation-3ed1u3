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

# Initialize router with health check tag
router = APIRouter(tags=['health'], prefix='/health')

# Performance thresholds (milliseconds)
CACHE_THRESHOLD_MS = 100
DB_THRESHOLD_MS = 200

async def check_database(db=Depends(get_db)) -> Dict[str, Any]:
    """
    Comprehensive database health check with performance metrics.
    """
    start_time = time.time()
    try:
        # Execute simple query to verify database connection
        db.execute("SELECT 1")
        
        # Get connection pool metrics
        pool_stats = db.get_bind().pool.status()
        
        response_time = (time.time() - start_time) * 1000
        
        health_status = {
            "status": "healthy" if response_time < DB_THRESHOLD_MS else "degraded",
            "response_time_ms": round(response_time, 2),
            "pool": {
                "size": pool_stats['pool_size'],
                "available": pool_stats['checkedin'],
                "used": pool_stats['checkedout'],
                "overflow": pool_stats['overflow']
            }
        }
        
        if response_time >= DB_THRESHOLD_MS:
            health_status["warning"] = f"Response time ({response_time}ms) exceeds threshold ({DB_THRESHOLD_MS}ms)"
            
        return health_status
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(e)}"
        )

async def check_cache() -> Dict[str, Any]:
    """
    Detailed Redis cache service health check with performance metrics.
    """
    start_time = time.time()
    try:
        cache_service = CacheService()
        
        # Check connectivity and get metrics
        stats = await cache_service.get_stats()
        is_connected = await cache_service.check_connectivity()
        metrics = await cache_service.get_metrics()
        
        response_time = (time.time() - start_time) * 1000
        
        health_status = {
            "status": "healthy" if response_time < CACHE_THRESHOLD_MS and is_connected else "degraded",
            "response_time_ms": round(response_time, 2),
            "connected": is_connected,
            "metrics": {
                "hit_ratio": stats.get('hit_ratio', 0),
                "memory_used_mb": round(stats.get('memory_used', 0) / 1024 / 1024, 2),
                "evicted_keys": stats.get('evicted_keys', 0),
                "connected_clients": stats.get('connected_clients', 0)
            }
        }
        
        if response_time >= CACHE_THRESHOLD_MS:
            health_status["warning"] = f"Response time ({response_time}ms) exceeds threshold ({CACHE_THRESHOLD_MS}ms)"
            
        return health_status
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cache health check failed: {str(e)}"
        )

@router.get('/', status_code=status.HTTP_200_OK)
async def get_health(db=Depends(get_db)) -> Dict[str, Any]:
    """
    Comprehensive system health check endpoint aggregating all component statuses.
    """
    start_time = time.time()
    
    try:
        # Check all critical components
        db_health = await check_database(db)
        cache_health = await check_cache()
        
        # Calculate overall system health
        system_healthy = (
            db_health["status"] == "healthy" and
            cache_health["status"] == "healthy"
        )
        
        response_time = (time.time() - start_time) * 1000
        
        return {
            "status": "healthy" if system_healthy else "degraded",
            "timestamp": time.time(),
            "response_time_ms": round(response_time, 2),
            "components": {
                "database": db_health,
                "cache": cache_health
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
    Kubernetes readiness probe endpoint with comprehensive service checks.
    """
    try:
        # Verify critical service availability
        db = next(get_db())
        db.execute("SELECT 1")
        
        cache_service = CacheService()
        await cache_service.check_connectivity()
        
        return {"status": "ready"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"System not ready: {str(e)}"
        )

@router.get('/live', status_code=status.HTTP_200_OK)
async def get_liveness() -> Dict[str, str]:
    """
    Kubernetes liveness probe endpoint for basic application health.
    """
    return {"status": "alive"}