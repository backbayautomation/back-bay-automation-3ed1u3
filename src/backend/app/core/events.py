"""
Core event handlers module for FastAPI application lifecycle management.
Implements startup and shutdown procedures with comprehensive error handling and monitoring.

Version: 1.0.0
"""

import asyncio
import logging
from typing import Optional
from fastapi import FastAPI  # version: 0.103.0

from .config import settings, get_settings
from ..db.session import init_db
from ..services.cache_service import CacheService

# Configure module logger
logger = logging.getLogger(__name__)

# Global service instances
cache_service: Optional[CacheService] = None

async def startup_event_handler(app: FastAPI) -> None:
    """
    Asynchronous handler for application startup tasks with comprehensive initialization
    and health validation for all critical services.
    """
    try:
        # Configure structured JSON logging
        settings.configure_logging()
        logger.info("Starting application initialization",
                   extra={'app_name': app.title})

        # Initialize database with retry mechanism
        retry_count = 0
        max_retries = 3
        while retry_count < max_retries:
            if init_db():
                logger.info("Database initialization successful")
                break
            retry_count += 1
            if retry_count < max_retries:
                await asyncio.sleep(2 ** retry_count)  # Exponential backoff
        else:
            raise RuntimeError("Database initialization failed after maximum retries")

        # Initialize Redis cache service
        global cache_service
        db_config = settings.get_database_settings()
        azure_config = settings.get_azure_settings()
        
        cache_service = CacheService(
            host=azure_config.get('redis_cache', 'localhost'),
            port=6379,
            db=0,
            password=azure_config.get('redis_password', ''),
            config={'default_ttl': 86400}  # 24 hours
        )
        logger.info("Cache service initialized successfully")

        # Initialize vector search service settings
        vector_config = settings.get_vector_search_settings()
        logger.info("Vector search configuration loaded",
                   extra={'config': vector_config})

        # Set up application state
        app.state.cache = cache_service
        app.state.vector_config = vector_config
        app.state.startup_timestamp = asyncio.get_event_loop().time()

        # Validate all service connections
        await validate_service_connections(app)

        logger.info("Application startup completed successfully",
                   extra={
                       'environment': settings.ENVIRONMENT,
                       'debug_mode': settings.DEBUG
                   })

    except Exception as e:
        logger.critical("Application startup failed",
                       extra={
                           'error_type': type(e).__name__,
                           'error_message': str(e)
                       },
                       exc_info=True)
        raise

async def shutdown_event_handler(app: FastAPI) -> None:
    """
    Asynchronous handler for graceful shutdown of all application services
    with comprehensive cleanup and resource management.
    """
    try:
        logger.info("Initiating application shutdown")

        # Stop accepting new requests
        app.state.shutting_down = True
        
        # Wait for ongoing requests to complete (30s timeout)
        try:
            await asyncio.wait_for(
                wait_for_connections_to_close(app),
                timeout=30.0
            )
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for connections to close")

        # Clean up cache connections
        if cache_service:
            await asyncio.to_thread(
                lambda: cache_service._client.close()
            )
            logger.info("Cache service connections closed")

        # Log final metrics
        uptime = asyncio.get_event_loop().time() - app.state.startup_timestamp
        logger.info("Application shutdown completed",
                   extra={
                       'uptime_seconds': uptime,
                       'environment': settings.ENVIRONMENT
                   })

    except Exception as e:
        logger.error("Error during application shutdown",
                    extra={
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    },
                    exc_info=True)
        raise

async def validate_service_connections(app: FastAPI) -> None:
    """
    Validates all critical service connections during startup.
    Raises exception if any critical service is unavailable.
    """
    try:
        # Validate database connection
        async with app.state.db.connect() as conn:
            await conn.execute("SELECT 1")
        
        # Validate cache connection
        if cache_service:
            await asyncio.to_thread(cache_service._client.ping)

        logger.info("All service connections validated successfully")

    except Exception as e:
        logger.error("Service connection validation failed",
                    extra={
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    })
        raise

async def wait_for_connections_to_close(app: FastAPI) -> None:
    """
    Waits for all active connections to complete during shutdown.
    Implements graceful shutdown with connection tracking.
    """
    try:
        # Wait for active connections to complete
        while app.state.active_connections > 0:
            logger.debug("Waiting for connections to close",
                        extra={'active_connections': app.state.active_connections})
            await asyncio.sleep(0.1)
    except Exception as e:
        logger.error("Error waiting for connections to close",
                    extra={
                        'error_type': type(e).__name__,
                        'error_message': str(e)
                    })
        raise

def register_event_handlers(app: FastAPI) -> None:
    """
    Registers startup and shutdown event handlers with comprehensive error handling.
    Ensures proper initialization and cleanup of application resources.
    """
    if not isinstance(app, FastAPI):
        raise ValueError("Invalid FastAPI application instance")

    try:
        # Register startup handler
        app.add_event_handler("startup", lambda: startup_event_handler(app))
        
        # Register shutdown handler
        app.add_event_handler("shutdown", lambda: shutdown_event_handler(app))

        # Initialize connection tracking
        app.state.active_connections = 0
        app.state.shutting_down = False

        logger.info("Event handlers registered successfully",
                   extra={'app_name': app.title})

    except Exception as e:
        logger.critical("Failed to register event handlers",
                       extra={
                           'error_type': type(e).__name__,
                           'error_message': str(e)
                       },
                       exc_info=True)
        raise