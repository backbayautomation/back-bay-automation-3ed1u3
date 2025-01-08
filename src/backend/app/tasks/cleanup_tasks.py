"""
Periodic cleanup tasks module for the AI-powered Product Catalog Search System.
Implements cache cleanup, temporary file removal, and stale document processing state cleanup.

Version: 1.0.0
"""

import os
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any

from celery import Task  # version: 5.3.0
from tenacity import retry, stop_after_attempt  # version: 8.2.0
from prometheus_client import Counter, Histogram, Gauge  # version: 0.17.0

from .celery_app import celery_app
from ..services.cache_service import CacheService
from ..core.config import get_settings
from ..constants import DocumentStatus

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
    'Number of items cleaned up',
    ['item_type']
)
memory_usage = Gauge(
    'memory_usage_bytes',
    'Current memory usage in bytes',
    ['resource_type']
)

@celery_app.task(
    name='tasks.cleanup_expired_cache',
    bind=True,
    max_retries=MAX_RETRY_ATTEMPTS,
    soft_time_limit=3600
)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_expired_cache(self: Task) -> bool:
    """
    Periodic task to clean up expired cache entries with enhanced error handling and monitoring.
    
    Returns:
        bool: Success status of cleanup operation
    """
    start_time = datetime.now()
    logger.info("Starting cache cleanup operation")
    
    try:
        # Initialize cache service
        settings = get_settings()
        cache_service = CacheService(
            host=settings.get_azure_settings()['redis_host'],
            port=settings.get_azure_settings()['redis_port'],
            db=0,
            password=settings.get_azure_settings()['redis_password']
        )

        # Get current cache statistics
        stats = await cache_service.get_stats()
        memory_usage.labels('cache').set(stats['memory_used_bytes'])
        
        # Log initial state
        logger.info(
            "Cache statistics before cleanup",
            extra={
                'memory_used': stats['memory_used_bytes'],
                'expired_keys': stats['expired_keys'],
                'evicted_keys': stats['evicted_keys']
            }
        )

        # Execute cleanup operation
        cleanup_operations.labels('cache').inc()
        with cleanup_duration.labels('cache').time():
            # Perform batch cleanup of expired entries
            expired_count = await cache_service.clear_expired()
            items_cleaned.labels('cache_entries').inc(expired_count)

        # Get post-cleanup statistics
        final_stats = await cache_service.get_stats()
        memory_freed = stats['memory_used_bytes'] - final_stats['memory_used_bytes']

        logger.info(
            "Cache cleanup completed successfully",
            extra={
                'duration_seconds': (datetime.now() - start_time).total_seconds(),
                'items_cleaned': expired_count,
                'memory_freed_bytes': memory_freed
            }
        )
        
        return True

    except Exception as e:
        logger.error(
            "Cache cleanup failed",
            extra={
                'error': str(e),
                'duration_seconds': (datetime.now() - start_time).total_seconds()
            },
            exc_info=True
        )
        raise self.retry(exc=e)

@celery_app.task(
    name='tasks.cleanup_stale_documents',
    bind=True,
    max_retries=MAX_RETRY_ATTEMPTS,
    soft_time_limit=3600
)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_stale_documents(self: Task) -> bool:
    """
    Periodic task to clean up stale document processing states with transaction management.
    
    Returns:
        bool: Success status of cleanup operation
    """
    start_time = datetime.now()
    stale_threshold = datetime.now() - timedelta(seconds=STALE_DOCUMENT_THRESHOLD)
    logger.info("Starting stale document cleanup operation")

    try:
        from ..models import Document, db
        
        cleanup_operations.labels('documents').inc()
        cleaned_count = 0

        with cleanup_duration.labels('documents').time():
            async with db.transaction():
                # Query stale documents in batches
                stale_docs = await Document.query.filter(
                    Document.status == DocumentStatus.PROCESSING,
                    Document.updated_at < stale_threshold
                ).limit(BATCH_SIZE).all()

                for doc in stale_docs:
                    # Reset document status
                    doc.status = DocumentStatus.FAILED
                    doc.error_message = "Processing timeout - exceeded threshold"
                    doc.updated_at = datetime.now()
                    
                    # Clean up associated temporary files
                    if doc.temp_file_path and os.path.exists(doc.temp_file_path):
                        os.remove(doc.temp_file_path)
                    
                    cleaned_count += 1

                await db.commit()

        items_cleaned.labels('stale_documents').inc(cleaned_count)
        
        logger.info(
            "Stale document cleanup completed successfully",
            extra={
                'duration_seconds': (datetime.now() - start_time).total_seconds(),
                'documents_cleaned': cleaned_count
            }
        )
        
        return True

    except Exception as e:
        logger.error(
            "Stale document cleanup failed",
            extra={
                'error': str(e),
                'duration_seconds': (datetime.now() - start_time).total_seconds()
            },
            exc_info=True
        )
        raise self.retry(exc=e)

@celery_app.task(
    name='tasks.cleanup_temporary_files',
    bind=True,
    max_retries=MAX_RETRY_ATTEMPTS,
    soft_time_limit=1800
)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_temporary_files(self: Task) -> bool:
    """
    Periodic task to remove temporary files with secure deletion and monitoring.
    
    Returns:
        bool: Success status of cleanup operation
    """
    start_time = datetime.now()
    temp_dir = get_settings().get_azure_settings()['temp_directory']
    logger.info("Starting temporary file cleanup operation")

    try:
        cleanup_operations.labels('temp_files').inc()
        cleaned_count = 0
        total_bytes_freed = 0

        with cleanup_duration.labels('temp_files').time():
            for root, _, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    file_stat = os.stat(file_path)
                    
                    # Check if file is older than threshold
                    if datetime.fromtimestamp(file_stat.st_mtime) < (
                        datetime.now() - timedelta(seconds=STALE_DOCUMENT_THRESHOLD)
                    ):
                        # Secure file deletion
                        file_size = file_stat.st_size
                        with open(file_path, 'wb') as f:
                            f.write(os.urandom(file_size))
                        os.remove(file_path)
                        
                        total_bytes_freed += file_size
                        cleaned_count += 1

        items_cleaned.labels('temp_files').inc(cleaned_count)
        memory_usage.labels('temp_storage').set(
            sum(os.path.getsize(os.path.join(temp_dir, f)) 
                for f in os.listdir(temp_dir) if os.path.isfile(os.path.join(temp_dir, f)))
        )

        logger.info(
            "Temporary file cleanup completed successfully",
            extra={
                'duration_seconds': (datetime.now() - start_time).total_seconds(),
                'files_cleaned': cleaned_count,
                'bytes_freed': total_bytes_freed
            }
        )
        
        return True

    except Exception as e:
        logger.error(
            "Temporary file cleanup failed",
            extra={
                'error': str(e),
                'duration_seconds': (datetime.now() - start_time).total_seconds()
            },
            exc_info=True
        )
        raise self.retry(exc=e)