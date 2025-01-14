"""
Cleanup tasks module for the AI-powered Product Catalog Search System.
Implements periodic cleanup operations for cache, temporary files, and stale document states.

Version: 1.0.0
"""

import logging
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any

from celery import Task  # version: 5.3.0
from tenacity import retry, stop_after_attempt  # version: 8.2.0
from prometheus_client import Counter, Histogram  # version: 0.17.0

from .celery_app import celery_app
from ..services.cache_service import CacheService
from ..core.config import get_settings

# Configure module logger
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
cleanup_errors = Counter(
    'cleanup_errors_total',
    'Total number of cleanup operation errors',
    ['operation_type']
)

@celery_app.task(name='tasks.cleanup_expired_cache', bind=True, max_retries=3)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_expired_cache(self: Task) -> bool:
    """
    Periodic task to clean up expired cache entries with enhanced error handling and monitoring.
    
    Returns:
        bool: Success status of cleanup operation
    """
    operation_start = datetime.now()
    settings = get_settings()
    
    try:
        # Initialize cache service with Azure Redis settings
        cache_service = CacheService(
            **settings.get_azure_settings()
        )

        # Get current cache statistics
        stats = await cache_service.get_stats()
        memory_used = stats.get('memory_used_bytes', 0)
        memory_threshold = int(MAX_CACHE_SIZE * 0.8)  # 80% threshold

        logger.info(
            "Starting cache cleanup operation",
            extra={
                'memory_used': memory_used,
                'memory_threshold': memory_threshold,
                'current_stats': stats
            }
        )

        # Perform cleanup if memory usage exceeds threshold
        if memory_used > memory_threshold:
            await cache_service.clear(
                pattern="*",
                batch_size=BATCH_SIZE
            )

        # Record metrics
        cleanup_operations.labels(operation_type='cache').inc()
        cleanup_duration.labels(operation_type='cache').observe(
            (datetime.now() - operation_start).total_seconds()
        )

        logger.info(
            "Cache cleanup completed successfully",
            extra={
                'duration': (datetime.now() - operation_start).total_seconds(),
                'new_stats': await cache_service.get_stats()
            }
        )
        return True

    except Exception as e:
        cleanup_errors.labels(operation_type='cache').inc()
        logger.error(
            "Cache cleanup failed",
            extra={
                'error': str(e),
                'duration': (datetime.now() - operation_start).total_seconds()
            },
            exc_info=True
        )
        raise

@celery_app.task(name='tasks.cleanup_stale_documents', bind=True, max_retries=3)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_stale_documents(self: Task) -> bool:
    """
    Periodic task to clean up stale document processing states with transaction management.
    
    Returns:
        bool: Success status of cleanup operation
    """
    operation_start = datetime.now()
    stale_threshold = datetime.now() - timedelta(seconds=STALE_DOCUMENT_THRESHOLD)
    
    try:
        from ..models import Document, DocumentStatus
        from ..database import get_db

        async with get_db() as db:
            # Begin transaction
            async with db.begin():
                # Query stale documents in batches
                stale_docs = await db.execute(
                    Document.select()
                    .where(
                        Document.status == DocumentStatus.PROCESSING,
                        Document.updated_at < stale_threshold
                    )
                    .limit(BATCH_SIZE)
                )

                cleanup_count = 0
                for doc in stale_docs:
                    # Reset document status
                    doc.status = DocumentStatus.FAILED
                    doc.error_message = "Processing timeout - exceeded threshold"
                    await db.merge(doc)

                    # Remove temporary processing files
                    temp_path = Path(f"/tmp/processing/{doc.id}")
                    if temp_path.exists():
                        await asyncio.to_thread(temp_path.unlink)
                    
                    cleanup_count += 1

                await db.commit()

        # Record metrics
        cleanup_operations.labels(operation_type='documents').inc()
        cleanup_duration.labels(operation_type='documents').observe(
            (datetime.now() - operation_start).total_seconds()
        )

        logger.info(
            "Document cleanup completed successfully",
            extra={
                'cleanup_count': cleanup_count,
                'duration': (datetime.now() - operation_start).total_seconds()
            }
        )
        return True

    except Exception as e:
        cleanup_errors.labels(operation_type='documents').inc()
        logger.error(
            "Document cleanup failed",
            extra={
                'error': str(e),
                'duration': (datetime.now() - operation_start).total_seconds()
            },
            exc_info=True
        )
        raise

@celery_app.task(name='tasks.cleanup_temporary_files', bind=True, max_retries=3)
@retry(stop=stop_after_attempt(MAX_RETRY_ATTEMPTS))
async def cleanup_temporary_files(self: Task) -> bool:
    """
    Periodic task to remove temporary files with secure deletion and monitoring.
    
    Returns:
        bool: Success status of cleanup operation
    """
    operation_start = datetime.now()
    temp_dir = Path("/tmp/processing")
    
    try:
        if not temp_dir.exists():
            return True

        cleanup_count = 0
        total_size = 0

        # Process files in batches
        async for file_path in _scan_directory(temp_dir):
            try:
                stats = await asyncio.to_thread(file_path.stat)
                file_age = datetime.now().timestamp() - stats.st_mtime

                if file_age > STALE_DOCUMENT_THRESHOLD:
                    # Secure file deletion
                    await _secure_delete(file_path)
                    cleanup_count += 1
                    total_size += stats.st_size

            except FileNotFoundError:
                continue
            except Exception as e:
                logger.warning(
                    f"Failed to process file {file_path}",
                    extra={'error': str(e)}
                )

        # Record metrics
        cleanup_operations.labels(operation_type='files').inc()
        cleanup_duration.labels(operation_type='files').observe(
            (datetime.now() - operation_start).total_seconds()
        )

        logger.info(
            "Temporary file cleanup completed successfully",
            extra={
                'cleanup_count': cleanup_count,
                'total_size_bytes': total_size,
                'duration': (datetime.now() - operation_start).total_seconds()
            }
        )
        return True

    except Exception as e:
        cleanup_errors.labels(operation_type='files').inc()
        logger.error(
            "Temporary file cleanup failed",
            extra={
                'error': str(e),
                'duration': (datetime.now() - operation_start).total_seconds()
            },
            exc_info=True
        )
        raise

async def _scan_directory(directory: Path) -> Path:
    """
    Asynchronously scan directory for files.
    
    Args:
        directory: Directory path to scan
        
    Yields:
        Path objects for each file found
    """
    for file_path in await asyncio.to_thread(directory.glob, "*"):
        if file_path.is_file():
            yield file_path

async def _secure_delete(file_path: Path) -> None:
    """
    Securely delete a file by overwriting with zeros before deletion.
    
    Args:
        file_path: Path to file for secure deletion
    """
    try:
        # Overwrite file with zeros
        size = file_path.stat().st_size
        with open(file_path, 'wb') as f:
            f.write(b'\0' * size)
            f.flush()
        
        # Remove file
        await asyncio.to_thread(file_path.unlink)
    except Exception as e:
        logger.error(
            f"Secure deletion failed for {file_path}",
            extra={'error': str(e)}
        )
        raise