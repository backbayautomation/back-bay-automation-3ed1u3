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
    Implements LRU caching strategy with configurable TTL and serialization formats.
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
        self._client = redis.Redis(
            host=host,
            port=port,
            db=db,
            password=password,
            decode_responses=False,
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
        self._default_ttl = config.get('default_ttl', DEFAULT_TTL) if config else DEFAULT_TTL
        
        # Configure Redis maxmemory and policy
        self._client.config_set('maxmemory', str(MAX_CACHE_SIZE))
        self._client.config_set('maxmemory-policy', 'allkeys-lru')

        # Verify connection and log startup
        self._verify_connection()
        logger.info(
            "Cache service initialized",
            extra={
                'host': host,
                'port': port,
                'db': db,
                'max_memory': MAX_CACHE_SIZE,
                'default_ttl': self._default_ttl
            }
        )

    def _verify_connection(self) -> None:
        """Verify Redis connection and cluster health."""
        try:
            self._client.ping()
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
            raise

    async def get(self, key: str, default_value: Optional[str] = None) -> Any:
        """
        Retrieve value from cache with automatic deserialization.

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
                logger.debug(f"Cache miss for key: {key}")
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
                value = raw_value[1:].decode('utf-8')

            self._metrics['hits'] += 1
            logger.debug(f"Cache hit for key: {key}")
            return value

        except Exception as e:
            self._metrics['errors'] += 1
            logger.error(f"Error retrieving from cache: {str(e)}", exc_info=True)
            return default_value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        serialization_format: Optional[str] = None
    ) -> bool:
        """
        Store value in cache with automatic serialization.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Optional TTL in seconds
            serialization_format: Optional serialization format ('json' or 'pickle')

        Returns:
            bool: Success status of cache operation
        """
        try:
            # Determine serialization format
            if serialization_format:
                format_flag = SERIALIZATION_FORMATS[serialization_format]
            else:
                format_flag = (SERIALIZATION_FORMATS['json'] 
                             if isinstance(value, (dict, list, str, int, float, bool))
                             else SERIALIZATION_FORMATS['pickle'])

            # Serialize value
            if format_flag == SERIALIZATION_FORMATS['json']:
                serialized = bytes([format_flag]) + json.dumps(value).encode('utf-8')
            else:
                serialized = bytes([format_flag]) + pickle.dumps(value)

            # Set in cache with TTL
            ttl = ttl if ttl is not None else self._default_ttl
            success = await asyncio.to_thread(
                self._client.setex,
                key,
                ttl,
                serialized
            )

            if success:
                self._metrics['set_operations'] += 1
                logger.debug(f"Successfully cached key: {key}, ttl: {ttl}")
            return bool(success)

        except Exception as e:
            self._metrics['errors'] += 1
            logger.error(f"Error setting cache key {key}: {str(e)}", exc_info=True)
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
            
            # Calculate hit rate
            total_ops = self._metrics['hits'] + self._metrics['misses']
            hit_rate = (self._metrics['hits'] / total_ops * 100) if total_ops > 0 else 0

            # Calculate uptime
            uptime = datetime.now().timestamp() - self._metrics['start_time']

            return {
                'hits': self._metrics['hits'],
                'misses': self._metrics['misses'],
                'hit_rate': round(hit_rate, 2),
                'set_operations': self._metrics['set_operations'],
                'errors': self._metrics['errors'],
                'uptime_seconds': int(uptime),
                'memory_used_bytes': info['used_memory'],
                'memory_peak_bytes': info['used_memory_peak'],
                'total_connections': info['total_connections_received'],
                'connected_clients': info['connected_clients'],
                'evicted_keys': info['evicted_keys'],
                'expired_keys': info['expired_keys'],
                'last_save_time': datetime.fromtimestamp(info['last_save_time']).isoformat()
            }

        except Exception as e:
            logger.error(f"Error retrieving cache stats: {str(e)}", exc_info=True)
            return {
                'error': str(e),
                'metrics': self._metrics
            }