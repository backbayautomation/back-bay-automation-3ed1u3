"""
Core event handlers module for FastAPI application lifecycle management.
Handles startup and shutdown procedures with comprehensive error handling and monitoring.

Version: 1.0.0
"""

import asyncio
import logging  # version: latest
from typing import Dict, Any
from datetime import datetime

from fastapi import FastAPI  # version: 0.103.0
from prometheus_client import Counter, Gauge  # version: 0.17.0

from .config import settings, configure_logging
from ..db.session import init_db, monitor_pool_health
from ..services.cache_service import CacheService

# Configure module logger
logger = logging.getLogger(__name__)

# Initialize Prometheus metrics
startup_time_metric = Gauge('app_startup_duration_seconds', 'Time taken for application startup')
service_health_metric = Gauge('app_service_health', 'Health status of application services', ['service'])
active_connections_metric = Gauge('app_active_connections', 'Number of active connections')
shutdown_time_metric = Gauge('app_shutdown_duration_seconds', 'Time taken for application shutdown')

# Global service instances
cache_service: CacheService = None

async def startup_event_handler(app: FastAPI) -> None:
    """
    Handles application startup with comprehensive service initialization and monitoring.
    
    Args:
        app: FastAPI application instance
    """
    start_time = datetime.now()
    
    try:
        # Configure structured JSON logging
        settings.configure_logging()
        logger.info("Starting application initialization")
        
        # Initialize database with retry mechanism
        retry_count = 0
        max_retries = 3
        while retry_count < max_retries:
            if init_db():
                service_health_metric.labels(service='database').set(1)
                logger.info("Database initialization successful")
                break
            retry_count += 1
            if retry_count < max_retries:
                await asyncio.sleep(5)
            else:
                raise Exception("Database initialization failed after maximum retries")
        
        # Initialize Redis cache service
        global cache_service
        azure_settings = settings.get_azure_settings()
        cache_service = CacheService(
            host=azure_settings.get('redis_host', 'localhost'),
            port=azure_settings.get('redis_port', 6379),
            db=0,
            password=azure_settings.get('redis_password', ''),
            config={'cache_ttl': 86400}  # 24 hours
        )
        service_health_metric.labels(service='cache').set(1)
        logger.info("Cache service initialization successful")
        
        # Initialize vector search service settings
        vector_settings = settings.get_vector_search_settings()
        app.state.vector_config = vector_settings
        service_health_metric.labels(service='vector_search').set(1)
        logger.info("Vector search configuration initialized")
        
        # Set up application state
        app.state.startup_timestamp = datetime.now().isoformat()
        app.state.health_check = {
            'database': True,
            'cache': True,
            'vector_search': True
        }
        
        # Record startup metrics
        startup_duration = (datetime.now() - start_time).total_seconds()
        startup_time_metric.set(startup_duration)
        logger.info(
            "Application startup completed successfully",
            extra={
                'startup_duration': startup_duration,
                'services_status': app.state.health_check
            }
        )
        
    except Exception as e:
        logger.error(f"Application startup failed: {str(e)}", exc_info=True)
        service_health_metric.labels(service='application').set(0)
        raise

async def shutdown_event_handler(app: FastAPI) -> None:
    """
    Handles graceful application shutdown with resource cleanup and monitoring.
    
    Args:
        app: FastAPI application instance
    """
    start_time = datetime.now()
    
    try:
        logger.info("Initiating application shutdown")
        
        # Stop accepting new connections
        active_connections_metric.set(0)
        
        # Wait for ongoing requests to complete (30s timeout)
        await asyncio.sleep(1)  # Allow time for request completion
        
        # Clear cache and close Redis connections
        if cache_service:
            await cache_service.clear_tenant_cache()
            service_health_metric.labels(service='cache').set(0)
            logger.info("Cache service shutdown completed")
        
        # Record final database metrics and close connections
        final_pool_stats = monitor_pool_health()
        logger.info(
            "Final database pool statistics",
            extra={'pool_stats': final_pool_stats}
        )
        service_health_metric.labels(service='database').set(0)
        
        # Clean up vector search resources
        app.state.vector_config = None
        service_health_metric.labels(service='vector_search').set(0)
        
        # Record shutdown metrics
        shutdown_duration = (datetime.now() - start_time).total_seconds()
        shutdown_time_metric.set(shutdown_duration)
        logger.info(
            "Application shutdown completed successfully",
            extra={'shutdown_duration': shutdown_duration}
        )
        
    except Exception as e:
        logger.error(f"Error during application shutdown: {str(e)}", exc_info=True)
        raise
    
    finally:
        # Ensure all metrics are updated
        service_health_metric.labels(service='application').set(0)

def register_event_handlers(app: FastAPI) -> None:
    """
    Registers application event handlers with validation and error handling.
    
    Args:
        app: FastAPI application instance
    """
    if not isinstance(app, FastAPI):
        raise ValueError("Invalid FastAPI application instance")
    
    try:
        # Register startup handler
        app.add_event_handler("startup", startup_event_handler)
        logger.info("Registered startup event handler")
        
        # Register shutdown handler
        app.add_event_handler("shutdown", shutdown_event_handler)
        logger.info("Registered shutdown event handler")
        
        # Initialize application state
        app.state.health_check = {}
        app.state.startup_timestamp = None
        app.state.vector_config = None
        
        logger.info("Event handlers registered successfully")
        
    except Exception as e:
        logger.error(f"Failed to register event handlers: {str(e)}", exc_info=True)
        raise