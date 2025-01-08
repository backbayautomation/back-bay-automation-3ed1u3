"""
Redis-based caching service for the AI-powered Product Catalog Search System.
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
    ):
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
            retry_on_timeout=True,
            health_check_interval=30
        )

        # Set default TTL from configuration
        self._default_ttl = config.get('default_ttl', DEFAULT_TTL)

        # Configure max memory and eviction policy
        self._client.config_set('maxmemory', str(MAX_CACHE_SIZE))
        self._client.config_set('maxmemory-policy', 'allkeys-lru')

        # Initialize metrics tracking
        self._metrics = {
            'hits': 0,
            'misses': 0,
            'stored_keys': 0,
            'last_eviction': None
        }

        # Verify connection and cluster health
        try:
            self._client.ping()
            logger.info("Cache service initialized successfully",
                       extra={'host': host, 'port': port, 'db': db})
        except redis.ConnectionError as e:
            logger.error("Failed to initialize cache service",
                        extra={'error': str(e), 'host': host, 'port': port})
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
                logger.debug("Cache miss", extra={'key': key})
                return default_value

            # Retrieve raw value and format flag
            raw_value = await asyncio.to_thread(self._client.get, key)
            format_flag = raw_value[0] if raw_value else None

            # Deserialize based on format flag
            if format_flag == SERIALIZATION_FORMATS['json']:
                value = json.loads(raw_value[1:].decode('utf-8'))
            elif format_flag == SERIALIZATION_FORMATS['pickle']:
                value = pickle.loads(raw_value[1:])
            else:
                value = raw_value.decode('utf-8')

            self._metrics['hits'] += 1
            logger.debug("Cache hit", extra={'key': key})
            return value

        except Exception as e:
            logger.error("Cache retrieval error",
                        extra={'key': key, 'error': str(e)})
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
            key: Cache key
            value: Value to cache
            ttl: Optional time-to-live in seconds
            serialization_format: Optional format override ('json' or 'pickle')

        Returns:
            bool: Success status of cache operation
        """
        try:
            # Determine serialization format
            if serialization_format:
                format_flag = SERIALIZATION_FORMATS[serialization_format]
            else:
                # Auto-detect best format
                try:
                    json.dumps(value)
                    format_flag = SERIALIZATION_FORMATS['json']
                except (TypeError, ValueError):
                    format_flag = SERIALIZATION_FORMATS['pickle']

            # Serialize value
            if format_flag == SERIALIZATION_FORMATS['json']:
                serialized = bytes([format_flag]) + json.dumps(value).encode('utf-8')
            else:
                serialized = bytes([format_flag]) + pickle.dumps(value)

            # Set value with TTL
            ttl = ttl if ttl is not None else self._default_ttl
            success = await asyncio.to_thread(
                self._client.setex,
                key,
                ttl,
                serialized
            )

            if success:
                self._metrics['stored_keys'] += 1
                logger.debug("Cache set successful",
                           extra={'key': key, 'ttl': ttl})
            return bool(success)

        except Exception as e:
            logger.error("Cache storage error",
                        extra={'key': key, 'error': str(e)})
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
            hit_ratio = (self._metrics['hits'] / total_ops) if total_ops > 0 else 0

            stats = {
                'hits': self._metrics['hits'],
                'misses': self._metrics['misses'],
                'hit_ratio': hit_ratio,
                'stored_keys': self._metrics['stored_keys'],
                'memory_used': info.get('used_memory', 0),
                'memory_peak': info.get('used_memory_peak', 0),
                'evicted_keys': info.get('evicted_keys', 0),
                'connected_clients': info.get('connected_clients', 0),
                'last_eviction': self._metrics['last_eviction'],
                'uptime_seconds': info.get('uptime_in_seconds', 0)
            }

            logger.info("Cache stats retrieved", extra={'stats': stats})
            return stats

        except Exception as e:
            logger.error("Failed to retrieve cache stats", extra={'error': str(e)})
            return {
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }