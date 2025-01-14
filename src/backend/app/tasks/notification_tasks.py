"""
Celery tasks for handling asynchronous notifications in the AI-powered Product Catalog Search System.
Implements real-time notifications with enhanced security, monitoring, and multi-tenant isolation.

Version: 1.0.0
"""

import redis  # version: 4.5.0
import json
import logging
import asyncio
from typing import Dict, Optional, Any
from functools import wraps
from datetime import datetime

from .celery_app import celery_app
from ..services.cache_service import CacheService

# Configure module logger
logger = logging.getLogger(__name__)

# Notification channel constants
NOTIFICATION_CHANNELS = {
    'DOCUMENT': 'document_processing',
    'CHAT': 'chat_notifications',
    'SYSTEM': 'system_alerts'
}

# Configuration constants
NOTIFICATION_TTL = 3600  # 1 hour
MAX_RETRIES = 3
RETRY_DELAY = 5
BATCH_SIZE = 100

def monitor_performance(func):
    """Decorator for monitoring notification performance and logging metrics."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = datetime.now()
        try:
            result = await func(*args, **kwargs)
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(
                "Notification task completed",
                extra={
                    'task_name': func.__name__,
                    'duration_seconds': elapsed,
                    'success': True
                }
            )
            return result
        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.error(
                "Notification task failed",
                extra={
                    'task_name': func.__name__,
                    'duration_seconds': elapsed,
                    'error': str(e),
                    'success': False
                }
            )
            raise
    return wrapper

class NotificationManager:
    """Enhanced notification manager with multi-tenant support, message persistence, and monitoring."""

    def __init__(self, redis_client: redis.Redis, cache_service: CacheService):
        """
        Initialize notification manager with enhanced monitoring and security.
        
        Args:
            redis_client: Redis client instance for pub/sub
            cache_service: Cache service for notification persistence
        """
        self._redis_client = redis_client
        self._cache_service = cache_service
        self._metrics = {
            'published': 0,
            'failed': 0,
            'latency': []
        }
        self._channel_health = {
            channel: {'errors': 0, 'last_error': None}
            for channel in NOTIFICATION_CHANNELS.values()
        }

    async def publish_notification(
        self,
        channel: str,
        message: Dict[str, Any],
        tenant_id: str
    ) -> bool:
        """
        Publishes notification with enhanced reliability and monitoring.
        
        Args:
            channel: Target notification channel
            message: Notification message content
            tenant_id: Client tenant identifier
            
        Returns:
            bool: Success status of notification publish
        """
        start_time = datetime.now()
        
        try:
            # Validate channel
            if channel not in NOTIFICATION_CHANNELS.values():
                raise ValueError(f"Invalid notification channel: {channel}")

            # Prepare notification payload
            notification = {
                'tenant_id': tenant_id,
                'channel': channel,
                'message': message,
                'timestamp': datetime.now().isoformat(),
                'message_id': f"{channel}_{tenant_id}_{start_time.timestamp()}"
            }

            # Serialize with validation
            try:
                payload = json.dumps(notification)
            except Exception as e:
                logger.error(
                    "Notification serialization failed",
                    extra={
                        'channel': channel,
                        'tenant_id': tenant_id,
                        'error': str(e)
                    }
                )
                raise

            # Publish to Redis channel
            await asyncio.to_thread(
                self._redis_client.publish,
                f"{channel}:{tenant_id}",
                payload
            )

            # Cache notification for persistence
            cache_key = f"notification:{notification['message_id']}"
            await self._cache_service.set(
                cache_key,
                notification,
                ttl=NOTIFICATION_TTL
            )

            # Update metrics
            elapsed = (datetime.now() - start_time).total_seconds()
            self._metrics['published'] += 1
            self._metrics['latency'].append(elapsed)

            logger.info(
                "Notification published successfully",
                extra={
                    'channel': channel,
                    'tenant_id': tenant_id,
                    'message_id': notification['message_id'],
                    'latency': elapsed
                }
            )
            return True

        except Exception as e:
            # Update error metrics
            self._metrics['failed'] += 1
            self._channel_health[channel]['errors'] += 1
            self._channel_health[channel]['last_error'] = str(e)

            logger.error(
                "Failed to publish notification",
                extra={
                    'channel': channel,
                    'tenant_id': tenant_id,
                    'error': str(e),
                    'stack_trace': True
                }
            )
            return False

@celery_app.task(bind=True, max_retries=MAX_RETRIES)
@monitor_performance
async def send_document_notification(
    self,
    document_id: str,
    status: str,
    progress: int,
    tenant_id: str
) -> bool:
    """
    Enhanced Celery task for document processing notifications with monitoring.
    
    Args:
        document_id: Unique document identifier
        status: Current processing status
        progress: Processing progress percentage
        tenant_id: Client tenant identifier
        
    Returns:
        bool: Notification delivery status
    """
    try:
        # Create notification manager instance
        redis_client = redis.Redis.from_url(celery_app.conf.broker_url)
        cache_service = CacheService(
            host=redis_client.connection_pool.connection_kwargs['host'],
            port=redis_client.connection_pool.connection_kwargs['port'],
            db=0,
            password=redis_client.connection_pool.connection_kwargs.get('password')
        )
        
        notification_manager = NotificationManager(redis_client, cache_service)

        # Prepare document notification message
        message = {
            'document_id': document_id,
            'status': status,
            'progress': progress,
            'timestamp': datetime.now().isoformat(),
            'metadata': {
                'retry_count': self.request.retries,
                'task_id': self.request.id
            }
        }

        # Publish notification with tenant isolation
        success = await notification_manager.publish_notification(
            NOTIFICATION_CHANNELS['DOCUMENT'],
            message,
            tenant_id
        )

        if not success and self.request.retries < MAX_RETRIES:
            raise self.retry(
                countdown=RETRY_DELAY * (2 ** self.request.retries)
            )

        return success

    except Exception as e:
        logger.error(
            "Document notification task failed",
            extra={
                'document_id': document_id,
                'tenant_id': tenant_id,
                'error': str(e),
                'retry_count': self.request.retries
            }
        )
        raise