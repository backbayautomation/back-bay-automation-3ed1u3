"""
Celery tasks for handling asynchronous notifications including document processing updates,
chat notifications, and system alerts with enhanced security and monitoring.

Version: 1.0.0
"""

import json
import logging
import asyncio
import redis  # version: 4.5.0
from functools import wraps
from datetime import datetime
from typing import Dict, Optional, Any

from .celery_app import celery_app
from ..services.cache_service import CacheService

# Configure logger
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
    """Decorator for monitoring notification task performance."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = datetime.now()
        try:
            result = func(*args, **kwargs)
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(
                "Notification task completed",
                extra={
                    'task_name': func.__name__,
                    'duration_seconds': duration,
                    'success': True
                }
            )
            return result
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(
                "Notification task failed",
                extra={
                    'task_name': func.__name__,
                    'duration_seconds': duration,
                    'error': str(e),
                    'success': False
                }
            )
            raise
    return wrapper

class NotificationManager:
    """Enhanced notification manager with multi-tenant support and monitoring."""

    def __init__(self, redis_client: redis.Redis, cache_service: CacheService):
        """Initialize notification manager with monitoring and security."""
        self._redis_client = redis_client
        self._cache_service = cache_service
        self._metrics = {
            'notifications_sent': 0,
            'delivery_failures': 0,
            'avg_delivery_time': 0.0
        }
        self._channel_health = {channel: True for channel in NOTIFICATION_CHANNELS.values()}

        logger.info("NotificationManager initialized", extra={'channels': NOTIFICATION_CHANNELS})

    async def publish_notification(self, channel: str, message: Dict, tenant_id: str) -> bool:
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
                'timestamp': datetime.now().isoformat(),
                'channel': channel,
                'message': message,
                'message_id': f"{tenant_id}_{datetime.now().timestamp()}",
                'metadata': {
                    'version': '1.0',
                    'priority': message.get('priority', 'normal')
                }
            }

            # Serialize notification
            serialized = json.dumps(notification)

            # Publish to Redis channel
            success = await asyncio.to_thread(
                self._redis_client.publish,
                f"{tenant_id}_{channel}",
                serialized
            )

            # Cache notification for persistence
            await self._cache_service.set(
                key=notification['message_id'],
                value=notification,
                ttl=NOTIFICATION_TTL
            )

            # Update metrics
            duration = (datetime.now() - start_time).total_seconds()
            self._metrics['notifications_sent'] += 1
            self._metrics['avg_delivery_time'] = (
                (self._metrics['avg_delivery_time'] * (self._metrics['notifications_sent'] - 1) + duration)
                / self._metrics['notifications_sent']
            )

            logger.info(
                "Notification published successfully",
                extra={
                    'channel': channel,
                    'tenant_id': tenant_id,
                    'message_id': notification['message_id'],
                    'duration_seconds': duration
                }
            )

            return bool(success)

        except Exception as e:
            self._metrics['delivery_failures'] += 1
            self._channel_health[channel] = False
            
            logger.error(
                "Failed to publish notification",
                extra={
                    'channel': channel,
                    'tenant_id': tenant_id,
                    'error': str(e),
                    'duration_seconds': (datetime.now() - start_time).total_seconds()
                }
            )
            raise

@celery_app.task(bind=True, max_retries=MAX_RETRIES)
@monitor_performance
def send_document_notification(
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
        # Create notification message
        message = {
            'document_id': document_id,
            'status': status,
            'progress': progress,
            'timestamp': datetime.now().isoformat(),
            'metadata': {
                'priority': 'high' if status in ['FAILED', 'COMPLETED'] else 'normal',
                'retry_count': self.request.retries
            }
        }

        # Get NotificationManager instance
        notification_manager = NotificationManager(
            redis_client=celery_app.redis,
            cache_service=celery_app.cache_service
        )

        # Publish notification
        success = asyncio.run(
            notification_manager.publish_notification(
                channel=NOTIFICATION_CHANNELS['DOCUMENT'],
                message=message,
                tenant_id=tenant_id
            )
        )

        logger.info(
            "Document notification sent",
            extra={
                'document_id': document_id,
                'status': status,
                'progress': progress,
                'tenant_id': tenant_id,
                'success': success
            }
        )

        return success

    except Exception as e:
        logger.error(
            "Failed to send document notification",
            extra={
                'document_id': document_id,
                'status': status,
                'tenant_id': tenant_id,
                'error': str(e),
                'retry_count': self.request.retries
            }
        )
        
        # Retry with exponential backoff
        retry_delay = RETRY_DELAY * (2 ** self.request.retries)
        raise self.retry(exc=e, countdown=retry_delay)