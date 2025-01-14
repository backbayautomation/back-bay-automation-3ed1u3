"""
Redis-based caching service implementation for the AI-powered Product Catalog Search System.
Provides efficient caching mechanisms with TTL management and monitoring capabilities.

Version: 1.0.0
"""

import redis  # version: 4.5.0
import json
import logging
import pickle
import asyncio
from typing import Any, Dict, Optional
from datetime import datetime

from ..core.config import get_settings

# Global constants
DEFAULT_TTL = 86400  # 24 hours in seconds
MAX_CACHE_SIZE = 10737418240  # 10GB in bytes
SERIALIZATION_FORMATS = {'json': 1, 'pickle': 2}

# Configure logger
logger = logging.getLogger(__name__)

class CacheService:
    """
    Enhanced Redis-based caching service with monitoring and complex object support.
    Implements efficient caching mechanisms for query results and frequently accessed data.
    """

    def __init__(
        self,
        host: str,
        port: int,
        db: int,
        password: str,
        config: Optional[Dict] = None
    ) -> None:
        """
        Initialize Redis cache client with enhanced configuration and monitoring.

        Args:
            host: Redis server hostname
            port: Redis server port
            db: Redis database number
            password: Redis authentication password
            config: Optional additional configuration parameters
        """
        # Initialize Redis client with connection parameters
        self._client = redis.Redis(
            host=host,
            port=port,
            db=db,
            password=password,
            decode_responses=False,  # Required for binary data handling
            socket_timeout=5.0,
            socket_connect_timeout=5.0,
            retry_on_timeout=True
        )

        # Initialize metrics tracking
        self._metrics = {
            'hits': 0,
            'misses': 0,
            'set_operations': 0,
            'errors': 0,
            'start_time': datetime.now().timestamp()
        }

        # Set default TTL and configure max memory
        self._default_ttl = config.get('cache_ttl', DEFAULT_TTL)
        self._configure_memory_settings()

        # Verify connection and log startup
        self._verify_connection()
        logger.info(
            "Cache service initialized",
            extra={
                'host': host,
                'port': port,
                'db': db,
                'default_ttl': self._default_ttl
            }
        )

    def _configure_memory_settings(self) -> None:
        """Configure Redis memory settings and eviction policy."""
        try:
            self._client.config_set('maxmemory', str(MAX_CACHE_SIZE))
            self._client.config_set('maxmemory-policy', 'allkeys-lru')
            logger.info(
                "Cache memory settings configured",
                extra={'max_memory': MAX_CACHE_SIZE}
            )
        except redis.RedisError as e:
            logger.error(
                "Failed to configure cache memory settings",
                extra={'error': str(e)}
            )
            raise

    def _verify_connection(self) -> None:
        """Verify Redis connection and cluster health."""
        try:
            self._client.ping()
        except redis.RedisError as e:
            logger.error(
                "Cache connection verification failed",
                extra={'error': str(e)}
            )
            raise

    async def get(self, key: str, default_value: Optional[str] = None) -> Any:
        """
        Enhanced retrieval of value from cache with type detection.

        Args:
            key: Cache key to retrieve
            default_value: Optional default value if key not found

        Returns:
            Cached value or default if not found
        """
        try:
            # Check if key exists
            if not await asyncio.to_thread(self._client.exists, key):
                self._metrics['misses'] += 1
                logger.debug(
                    "Cache miss",
                    extra={'key': key}
                )
                return default_value

            # Retrieve raw value and format indicator
            raw_value = await asyncio.to_thread(self._client.get, key)
            format_indicator = raw_value[0] if raw_value else None

            # Deserialize based on format
            if format_indicator == SERIALIZATION_FORMATS['json']:
                value = json.loads(raw_value[1:].decode('utf-8'))
            elif format_indicator == SERIALIZATION_FORMATS['pickle']:
                value = pickle.loads(raw_value[1:])
            else:
                value = raw_value.decode('utf-8')

            self._metrics['hits'] += 1
            logger.debug(
                "Cache hit",
                extra={'key': key}
            )
            return value

        except Exception as e:
            self._metrics['errors'] += 1
            logger.error(
                "Cache get operation failed",
                extra={'key': key, 'error': str(e)}
            )
            return default_value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        serialization_format: Optional[str] = None
    ) -> bool:
        """
        Enhanced storage of value in cache with automatic serialization.

        Args:
            key: Cache key to store
            value: Value to cache
            ttl: Optional time-to-live in seconds
            serialization_format: Optional format override ('json' or 'pickle')

        Returns:
            bool: Success status of cache operation
        """
        try:
            # Determine serialization format
            if serialization_format:
                format_type = SERIALIZATION_FORMATS[serialization_format]
            else:
                format_type = (
                    SERIALIZATION_FORMATS['json']
                    if isinstance(value, (dict, list, str, int, float, bool))
                    else SERIALIZATION_FORMATS['pickle']
                )

            # Serialize value
            if format_type == SERIALIZATION_FORMATS['json']:
                serialized = bytes([format_type]) + json.dumps(value).encode('utf-8')
            else:
                serialized = bytes([format_type]) + pickle.dumps(value)

            # Set value with TTL
            ttl = ttl if ttl is not None else self._default_ttl
            success = await asyncio.to_thread(
                self._client.setex,
                key,
                ttl,
                serialized
            )

            if success:
                self._metrics['set_operations'] += 1
                logger.debug(
                    "Cache set operation successful",
                    extra={
                        'key': key,
                        'ttl': ttl,
                        'format': 'json' if format_type == 1 else 'pickle'
                    }
                )
            return bool(success)

        except Exception as e:
            self._metrics['errors'] += 1
            logger.error(
                "Cache set operation failed",
                extra={'key': key, 'error': str(e)}
            )
            return False

    async def get_stats(self) -> Dict:
        """
        Retrieve detailed cache statistics and metrics.

        Returns:
            Dict containing comprehensive cache statistics
        """
        try:
            # Get Redis INFO
            info = await asyncio.to_thread(self._client.info)
            
            # Calculate hit ratio
            total_ops = self._metrics['hits'] + self._metrics['misses']
            hit_ratio = (
                self._metrics['hits'] / total_ops
                if total_ops > 0 else 0
            )

            # Compile statistics
            stats = {
                'hits': self._metrics['hits'],
                'misses': self._metrics['misses'],
                'hit_ratio': hit_ratio,
                'set_operations': self._metrics['set_operations'],
                'errors': self._metrics['errors'],
                'uptime_seconds': int(datetime.now().timestamp() - self._metrics['start_time']),
                'memory_used_bytes': info.get('used_memory', 0),
                'memory_peak_bytes': info.get('used_memory_peak', 0),
                'total_connections': info.get('total_connections_received', 0),
                'connected_clients': info.get('connected_clients', 0)
            }

            logger.info(
                "Cache statistics retrieved",
                extra={'stats': stats}
            )
            return stats

        except Exception as e:
            logger.error(
                "Failed to retrieve cache statistics",
                extra={'error': str(e)}
            )
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }