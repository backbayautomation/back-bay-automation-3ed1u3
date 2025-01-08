"""
Celery task module implementing enterprise-grade asynchronous document processing tasks.
Provides distributed document processing with GPU acceleration, monitoring, and tenant isolation.

Version: 1.0.0
"""

import logging
import asyncio
import celery
from typing import Dict, Optional
from uuid import UUID
from prometheus_client import Counter, Histogram, Gauge
from opentelemetry import trace

from app.tasks.celery_app import task
from app.services.document_processor import DocumentProcessor
from app.models.document import Document
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Constants
RETRY_BACKOFF = 300  # 5 minutes
MAX_RETRIES = 3
BATCH_SIZE = 32
MAX_DOCUMENT_SIZE_MB = 100
PROCESSING_TIMEOUT = 600  # 10 minutes

# Prometheus metrics
PROCESSING_REQUESTS = Counter('document_processing_requests_total', 'Total document processing requests')
PROCESSING_ERRORS = Counter('document_processing_errors_total', 'Total processing errors')
PROCESSING_DURATION = Histogram('document_processing_duration_seconds', 'Document processing duration')
PROCESSING_QUEUE_SIZE = Gauge('document_processing_queue_size', 'Current size of processing queue')
OCR_QUALITY_SCORE = Gauge('document_ocr_quality_score', 'OCR processing quality score')

# Initialize tracer
tracer = trace.get_tracer(__name__)

@task(
    bind=True,
    name='tasks.process_document',
    max_retries=MAX_RETRIES,
    retry_backoff=True,
    time_limit=PROCESSING_TIMEOUT,
    soft_time_limit=PROCESSING_TIMEOUT-30
)
async def process_document_task(
    self,
    document_id: UUID,
    tenant_id: UUID,
    processing_options: Optional[Dict] = None
) -> Dict:
    """
    Enterprise-grade Celery task for processing documents with comprehensive monitoring.

    Args:
        document_id: Document identifier
        tenant_id: Client/tenant identifier
        processing_options: Optional processing configuration

    Returns:
        Dict containing processing results and metrics

    Raises:
        celery.exceptions.Retry: If task should be retried
        RuntimeError: If processing fails permanently
    """
    PROCESSING_REQUESTS.inc()
    processing_start = asyncio.get_event_loop().time()

    try:
        # Initialize correlation ID for request tracking
        correlation_id = f"proc_{document_id}_{self.request.id}"
        logger.info(
            "Starting document processing",
            extra={
                'correlation_id': correlation_id,
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'task_id': self.request.id
            }
        )

        # Get document from database
        document = await Document.get_by_id(document_id)
        if not document:
            raise ValueError(f"Document {document_id} not found")

        # Validate tenant access
        if str(document.client.id) != str(tenant_id):
            raise PermissionError("Invalid tenant access")

        # Update document status
        await document.update_status('processing')
        await document.update_progress(0)

        # Initialize document processor
        processor = DocumentProcessor(
            settings.get_document_processing_settings(),
            tenant_id=tenant_id
        )

        # Process document with progress tracking
        async def progress_callback(progress: float):
            await document.update_progress(progress)

        processing_result = await processor.process_document(
            document,
            progress_callback=progress_callback,
            options=processing_options
        )

        # Update document status and metadata
        await document.update_status('completed')
        await document.update_metadata({
            'processing_metrics': processing_result['metrics'],
            'ocr_quality': processing_result['metrics']['ocr_quality'],
            'chunk_count': processing_result['metrics']['chunk_count'],
            'processing_time': asyncio.get_event_loop().time() - processing_start
        })

        # Update monitoring metrics
        PROCESSING_DURATION.observe(processing_result['metrics']['processing_time'])
        OCR_QUALITY_SCORE.set(processing_result['metrics']['ocr_quality'])

        logger.info(
            "Document processing completed successfully",
            extra={
                'correlation_id': correlation_id,
                'document_id': str(document_id),
                'processing_time': processing_result['metrics']['processing_time'],
                'chunks_processed': processing_result['metrics']['chunk_count']
            }
        )

        return {
            'status': 'completed',
            'document_id': str(document_id),
            'processing_time': processing_result['metrics']['processing_time'],
            'metrics': processing_result['metrics']
        }

    except (ValueError, PermissionError) as e:
        # Non-retryable errors
        logger.error(
            f"Document processing failed permanently: {str(e)}",
            extra={
                'correlation_id': correlation_id,
                'document_id': str(document_id),
                'error_type': type(e).__name__
            },
            exc_info=True
        )
        PROCESSING_ERRORS.inc()
        
        # Update document status
        await document.update_status('failed')
        await document.update_metadata({
            'error': str(e),
            'error_type': type(e).__name__
        })

        # Trigger cleanup
        await cleanup_failed_document_task.delay(
            document_id,
            tenant_id,
            str(e)
        )

        raise RuntimeError(f"Document processing failed: {str(e)}")

    except Exception as e:
        # Retryable errors
        retry_count = self.request.retries
        
        logger.warning(
            f"Document processing failed (attempt {retry_count + 1}/{MAX_RETRIES}): {str(e)}",
            extra={
                'correlation_id': correlation_id,
                'document_id': str(document_id),
                'retry_count': retry_count,
                'error_type': type(e).__name__
            },
            exc_info=True
        )

        # Update document status
        await document.update_metadata({
            'last_error': str(e),
            'retry_count': retry_count + 1
        })

        if retry_count < MAX_RETRIES:
            raise self.retry(
                exc=e,
                countdown=RETRY_BACKOFF * (retry_count + 1),
                max_retries=MAX_RETRIES
            )
        
        # Max retries exceeded
        PROCESSING_ERRORS.inc()
        await document.update_status('failed')
        await cleanup_failed_document_task.delay(
            document_id,
            tenant_id,
            str(e)
        )
        
        raise RuntimeError(f"Document processing failed after {MAX_RETRIES} retries: {str(e)}")

@task(
    name='tasks.cleanup_failed_document',
    time_limit=300
)
async def cleanup_failed_document_task(
    document_id: UUID,
    tenant_id: UUID,
    failure_reason: str
) -> Dict:
    """
    Cleanup task for failed document processing with resource management.

    Args:
        document_id: Document identifier
        tenant_id: Client/tenant identifier
        failure_reason: Reason for processing failure

    Returns:
        Dict containing cleanup status and details
    """
    try:
        logger.info(
            "Starting cleanup for failed document",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'failure_reason': failure_reason
            }
        )

        # Get document
        document = await Document.get_by_id(document_id)
        if not document:
            raise ValueError(f"Document {document_id} not found")

        # Validate tenant access
        if str(document.client.id) != str(tenant_id):
            raise PermissionError("Invalid tenant access")

        # Initialize processor for cleanup
        processor = DocumentProcessor(
            settings.get_document_processing_settings(),
            tenant_id=tenant_id
        )

        # Release GPU resources
        await processor.cleanup_resources(document_id)

        # Remove temporary files
        await processor.cleanup_temporary_files(document_id)

        # Update document status and metadata
        await document.update_status('failed')
        await document.update_metadata({
            'cleanup_timestamp': asyncio.get_event_loop().time(),
            'failure_reason': failure_reason,
            'resources_cleaned': True
        })

        logger.info(
            "Document cleanup completed",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id)
            }
        )

        return {
            'status': 'completed',
            'document_id': str(document_id),
            'cleanup_successful': True
        }

    except Exception as e:
        logger.error(
            f"Document cleanup failed: {str(e)}",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'error_type': type(e).__name__
            },
            exc_info=True
        )
        
        return {
            'status': 'failed',
            'document_id': str(document_id),
            'error': str(e),
            'cleanup_successful': False
        }