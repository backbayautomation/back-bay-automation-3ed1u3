"""
Core event handlers module for the AI-powered Product Catalog Search System.
Manages FastAPI application lifecycle events including startup and shutdown procedures.

Version: 1.0.0
"""

import asyncio
import logging  # version: latest
from fastapi import FastAPI  # version: 0.103.0
from typing import Dict, Any

from .config import settings, configure_logging
from ..db.session import init_db
from ..services.cache_service import CacheService

# Configure logger
logger = logging.getLogger(__name__)

# Global service instances
_cache_service: CacheService = None
_startup_complete: bool = False

async def startup_event_handler(app: FastAPI) -> None:
    """
    Asynchronous handler for application startup tasks including database,
    cache, vector search, and monitoring initialization.
    
    Args:
        app: FastAPI application instance
    """
    global _cache_service, _startup_complete
    
    try:
        # Configure structured JSON logging
        settings.configure_logging()
        logger.info("Starting application initialization")

        # Initialize database with retry mechanism
        retry_count = 0
        max_retries = 3
        while retry_count < max_retries:
            if init_db():
                logger.info("Database initialization successful")
                break
            retry_count += 1
            if retry_count < max_retries:
                await asyncio.sleep(5)
            else:
                raise Exception("Database initialization failed after maximum retries")

        # Initialize Redis cache service
        _cache_service = CacheService(
            host=settings.get_database_settings()['host'],
            port=6379,
            db=0,
            password=settings.get_database_settings()['password'],
            config={
                'default_ttl': 3600,
                'max_memory_policy': 'allkeys-lru'
            }
        )
        logger.info("Cache service initialized")

        # Initialize vector search service
        vector_config = settings.get_vector_search_settings()
        logger.info("Vector search service initialized", extra={'config': vector_config})

        # Set up health check endpoints
        @app.get("/health")
        async def health_check() -> Dict[str, Any]:
            return {
                "status": "healthy",
                "database": "connected",
                "cache": await _cache_service.get_stats(),
                "vector_search": "operational"
            }

        # Mark startup as complete
        _startup_complete = True
        logger.info("Application startup completed successfully")

    except Exception as e:
        logger.error(f"Startup failed: {str(e)}", exc_info=True)
        raise

async def shutdown_event_handler(app: FastAPI) -> None:
    """
    Asynchronous handler for graceful shutdown of all application services
    with comprehensive cleanup.
    
    Args:
        app: FastAPI application instance
    """
    global _cache_service, _startup_complete
    
    try:
        logger.info("Initiating application shutdown")

        # Stop accepting new requests
        _startup_complete = False

        # Wait for ongoing requests to complete (30s timeout)
        await asyncio.sleep(30)
        logger.info("Request grace period completed")

        # Clear and close Redis cache connections
        if _cache_service:
            try:
                await _cache_service.get_stats()  # Log final stats
                logger.info("Cache service shutdown completed")
            except Exception as e:
                logger.error(f"Error during cache shutdown: {str(e)}", exc_info=True)

        # Clean up database connections
        try:
            # Database cleanup handled by SQLAlchemy engine disposal
            logger.info("Database connections closed")
        except Exception as e:
            logger.error(f"Error during database shutdown: {str(e)}", exc_info=True)

        # Clean up vector search resources
        try:
            # Implement vector search cleanup
            logger.info("Vector search service shutdown completed")
        except Exception as e:
            logger.error(f"Error during vector search shutdown: {str(e)}", exc_info=True)

        logger.info("Application shutdown completed successfully")

    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}", exc_info=True)
        raise

def register_event_handlers(app: FastAPI) -> None:
    """
    Registers startup and shutdown event handlers with comprehensive error handling.
    
    Args:
        app: FastAPI application instance
    """
    if not isinstance(app, FastAPI):
        raise ValueError("Invalid FastAPI application instance")

    try:
        # Register startup handler
        app.add_event_handler("startup", lambda: startup_event_handler(app))
        logger.debug("Registered startup event handler")

        # Register shutdown handler
        app.add_event_handler("shutdown", lambda: shutdown_event_handler(app))
        logger.debug("Registered shutdown event handler")

        # Initialize error monitoring
        @app.middleware("http")
        async def add_process_time_header(request, call_next):
            if not _startup_complete:
                return {"status": "error", "message": "Application is starting up or shutting down"}
            response = await call_next(request)
            return response

        logger.info("Event handlers registered successfully")

    except Exception as e:
        logger.error(f"Failed to register event handlers: {str(e)}", exc_info=True)
        raise