"""
Cleanup tasks module for the AI-powered Product Catalog Search System.
Implements periodic cleanup operations for cache, documents, and temporary files.

Version: 1.0.0
"""

import logging
import asyncio
import os
from datetime import datetime, timedelta
from typing import Dict, Any

from celery import Task  # version: 5.3.0
from tenacity import retry, stop_after_attempt  # version: 8.2.0
from prometheus_client import Counter, Histogram  # version: 0.17.0

from .celery_app import celery_app
from ..services.cache_service import CacheService
from ..core.config import get_settings

# Configure logger
logger = logging.getLogger(__name__)

# Global constants
CACHE_CLEANUP_INTERVAL = 3600 * 24  # 24 hours
STALE_DOCUMENT_THRESHOLD = 3600 * 48  # 48 hours
MAX_RETRY_ATTEMPTS = 3
BATCH_SIZE = 1000

# Prometheus metrics
cleanup_operations = Counter(
    'cleanup_operations_total',
    'Total number of cleanup operations',
    ['operation_type']
)
cleanup_duration = Histogram(
    'cleanup_duration_seconds',
    'Duration of cleanup operations',
    ['operation_type']
)
items_cleaned = Counter(
    'items_cleaned_total',
    'Total number of items cleaned',
    ['item_type']
)

@celery_app.task(name='tasks.cleanup_expired_cache', bind=True, max_retries=3)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_expired_cache(self: Task) -> bool:
    """
    Periodic task to clean up expired cache entries with monitoring and metrics.

    Returns:
        bool: Success status of cleanup operation
    """
    start_time = datetime.utcnow()
    logger.info("Starting cache cleanup operation")
    
    try:
        # Initialize cache service with settings
        settings = get_settings()
        cache_service = CacheService(**settings.get_azure_settings())

        # Get current cache statistics
        stats = await cache_service.get_stats()
        memory_usage = stats.get('memory_used', 0)
        memory_threshold = int(0.9 * MAX_CACHE_SIZE)  # 90% threshold

        if memory_usage > memory_threshold:
            logger.warning("Cache memory usage above threshold",
                         extra={'memory_usage': memory_usage,
                               'threshold': memory_threshold})

        # Execute cleanup in batches
        cleaned_count = 0
        async for keys in cache_service.scan_iter(count=BATCH_SIZE):
            for key in keys:
                if await cache_service.ttl(key) <= 0:
                    await cache_service.delete(key)
                    cleaned_count += 1

        # Record metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        cleanup_operations.labels(operation_type='cache').inc()
        cleanup_duration.labels(operation_type='cache').observe(duration)
        items_cleaned.labels(item_type='cache_entries').inc(cleaned_count)

        logger.info("Cache cleanup completed",
                   extra={'cleaned_entries': cleaned_count,
                         'duration_seconds': duration})
        return True

    except Exception as e:
        logger.error("Cache cleanup failed",
                    extra={'error': str(e),
                          'retry_count': self.request.retries})
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

@celery_app.task(name='tasks.cleanup_stale_documents', bind=True, max_retries=3)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_stale_documents(self: Task) -> bool:
    """
    Periodic task to clean up stale document processing states.

    Returns:
        bool: Success status of cleanup operation
    """
    start_time = datetime.utcnow()
    logger.info("Starting stale document cleanup")

    try:
        from ..models import Document
        from ..constants import DocumentStatus
        from sqlalchemy.ext.asyncio import AsyncSession
        from ..db.session import get_session

        stale_threshold = datetime.utcnow() - timedelta(seconds=STALE_DOCUMENT_THRESHOLD)
        cleaned_count = 0

        async with get_session() as session:
            async with session.begin():
                # Process documents in batches
                query = (
                    session.query(Document)
                    .filter(Document.status == DocumentStatus.PROCESSING)
                    .filter(Document.updated_at < stale_threshold)
                    .limit(BATCH_SIZE)
                )

                async for document in query:
                    document.status = DocumentStatus.FAILED
                    document.error_message = "Processing timeout - cleaned up by maintenance task"
                    cleaned_count += 1

                await session.commit()

        # Record metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        cleanup_operations.labels(operation_type='documents').inc()
        cleanup_duration.labels(operation_type='documents').observe(duration)
        items_cleaned.labels(item_type='stale_documents').inc(cleaned_count)

        logger.info("Document cleanup completed",
                   extra={'cleaned_documents': cleaned_count,
                         'duration_seconds': duration})
        return True

    except Exception as e:
        logger.error("Document cleanup failed",
                    extra={'error': str(e),
                          'retry_count': self.request.retries})
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

@celery_app.task(name='tasks.cleanup_temporary_files', bind=True, max_retries=3)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_temporary_files(self: Task) -> bool:
    """
    Periodic task to remove temporary files with secure deletion.

    Returns:
        bool: Success status of cleanup operation
    """
    start_time = datetime.utcnow()
    logger.info("Starting temporary file cleanup")

    try:
        settings = get_settings()
        temp_dir = os.path.join(settings.BASE_DIR, 'temp')
        cleaned_count = 0
        total_size_cleaned = 0

        # Process files in batches
        for root, _, files in os.walk(temp_dir):
            for filename in files:
                file_path = os.path.join(root, filename)
                file_stat = os.stat(file_path)
                file_age = datetime.utcnow() - datetime.fromtimestamp(file_stat.st_mtime)

                if file_age.total_seconds() > STALE_DOCUMENT_THRESHOLD:
                    # Secure file deletion
                    file_size = os.path.getsize(file_path)
                    with open(file_path, 'wb') as f:
                        f.write(os.urandom(file_size))
                    os.remove(file_path)
                    
                    cleaned_count += 1
                    total_size_cleaned += file_size

        # Record metrics
        duration = (datetime.utcnow() - start_time).total_seconds()
        cleanup_operations.labels(operation_type='files').inc()
        cleanup_duration.labels(operation_type='files').observe(duration)
        items_cleaned.labels(item_type='temp_files').inc(cleaned_count)

        logger.info("Temporary file cleanup completed",
                   extra={'cleaned_files': cleaned_count,
                         'total_size_mb': total_size_cleaned / (1024 * 1024),
                         'duration_seconds': duration})
        return True

    except Exception as e:
        logger.error("Temporary file cleanup failed",
                    extra={'error': str(e),
                          'retry_count': self.request.retries})
        raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))