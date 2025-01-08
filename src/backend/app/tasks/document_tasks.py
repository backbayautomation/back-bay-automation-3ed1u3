"""
Celery task module implementing enterprise-grade asynchronous document processing tasks.
Handles multi-format document ingestion, GPU-accelerated OCR processing, chunking,
and vector indexing with comprehensive monitoring and error handling.

Version: 1.0.0
"""

import logging
import asyncio  # version: Python 3.11+
from celery import Task  # version: 5.3.0
from datetime import datetime
from typing import Dict, Any, Optional
from uuid import UUID
from prometheus_client import Counter, Histogram, Gauge  # version: 0.17.0
from opentelemetry import trace  # version: 1.20.0

from app.tasks.celery_app import task
from app.services.document_processor import DocumentProcessor
from app.models.document import Document
from app.core.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Constants
RETRY_BACKOFF = 300  # 5 minutes between retries
MAX_RETRIES = 3
BATCH_SIZE = 32
MAX_DOCUMENT_SIZE_MB = 100
PROCESSING_TIMEOUT = 600  # 10 minutes

# Initialize metrics
PROCESSING_DURATION = Histogram(
    'document_processing_duration_seconds',
    'Document processing duration in seconds'
)
DOCUMENT_COUNTER = Counter(
    'documents_processed_total',
    'Total documents processed',
    ['status', 'tenant_id']
)
ACTIVE_DOCUMENTS = Gauge(
    'documents_processing_active',
    'Number of documents currently processing',
    ['tenant_id']
)
ERROR_COUNTER = Counter(
    'document_processing_errors_total',
    'Document processing errors',
    ['error_type', 'tenant_id']
)

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
    self: Task,
    document_id: UUID,
    tenant_id: UUID,
    processing_options: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Enterprise-grade Celery task for processing documents with comprehensive
    error handling, monitoring, and tenant isolation.

    Args:
        document_id: UUID of document to process
        tenant_id: UUID of tenant owning the document
        processing_options: Dictionary of processing parameters

    Returns:
        Dict containing processing results and metrics
    """
    # Initialize monitoring
    ACTIVE_DOCUMENTS.labels(tenant_id=str(tenant_id)).inc()
    start_time = datetime.utcnow()

    try:
        with tracer.start_as_current_span("process_document") as span:
            span.set_attribute("document_id", str(document_id))
            span.set_attribute("tenant_id", str(tenant_id))

            # Retrieve document
            document = await Document.get_by_id(document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            # Validate tenant access
            if str(document.client.org_id) != str(tenant_id):
                raise PermissionError("Invalid tenant access")

            # Update document status
            await document.update_status("processing")
            await document.update_progress(0)

            # Initialize document processor
            processor = DocumentProcessor(
                ocr_service=settings.get_ocr_service(),
                ai_service=settings.get_ai_service(),
                vector_search=settings.get_vector_search_service(),
                config=processing_options
            )

            # Process document
            with PROCESSING_DURATION.time():
                processing_result = await processor.process_document(
                    document=document,
                    tenant_id=str(tenant_id)
                )

            # Update document metadata
            await document.update_metadata({
                'processing_stats': {
                    'duration': (datetime.utcnow() - start_time).total_seconds(),
                    'chunks_processed': processing_result['chunks_processed'],
                    'embeddings_generated': processing_result['embeddings_generated'],
                    'ocr_quality_score': processing_result.get('ocr_quality_score', 0)
                }
            })

            # Update final status
            await document.update_status("completed")
            await document.update_progress(100)

            # Update metrics
            DOCUMENT_COUNTER.labels(
                status='completed',
                tenant_id=str(tenant_id)
            ).inc()

            return {
                'status': 'completed',
                'document_id': str(document_id),
                'processing_stats': processing_result,
                'duration': (datetime.utcnow() - start_time).total_seconds()
            }

    except Exception as e:
        error_type = type(e).__name__
        ERROR_COUNTER.labels(
            error_type=error_type,
            tenant_id=str(tenant_id)
        ).inc()

        logger.error(
            f"Document processing error: {str(e)}",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'error_type': error_type
            },
            exc_info=True
        )

        # Update document status
        if document:
            await document.update_status("failed")
            await document.update_metadata({
                'error': {
                    'type': error_type,
                    'message': str(e),
                    'timestamp': datetime.utcnow().isoformat()
                }
            })

        # Retry if appropriate
        if self.request.retries < MAX_RETRIES:
            raise self.retry(
                exc=e,
                countdown=RETRY_BACKOFF * (2 ** self.request.retries)
            )
        raise

    finally:
        ACTIVE_DOCUMENTS.labels(tenant_id=str(tenant_id)).dec()

@task(
    name='tasks.cleanup_failed_document',
    time_limit=300
)
async def cleanup_failed_document_task(
    document_id: UUID,
    tenant_id: UUID,
    failure_reason: str
) -> Dict[str, Any]:
    """
    Cleanup task for failed document processing with resource management
    and error tracking.

    Args:
        document_id: UUID of failed document
        tenant_id: UUID of tenant owning the document
        failure_reason: Reason for processing failure

    Returns:
        Dict containing cleanup status and details
    """
    try:
        with tracer.start_as_current_span("cleanup_failed_document") as span:
            span.set_attribute("document_id", str(document_id))
            span.set_attribute("tenant_id", str(tenant_id))

            # Retrieve document
            document = await Document.get_by_id(document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")

            # Validate tenant access
            if str(document.client.org_id) != str(tenant_id):
                raise PermissionError("Invalid tenant access")

            # Initialize processor for cleanup
            processor = DocumentProcessor(
                ocr_service=settings.get_ocr_service(),
                ai_service=settings.get_ai_service(),
                vector_search=settings.get_vector_search_service(),
                config={}
            )

            # Cleanup resources
            await processor.cleanup_resources(document)

            # Update document status and metadata
            await document.update_status("failed")
            await document.update_metadata({
                'cleanup': {
                    'timestamp': datetime.utcnow().isoformat(),
                    'failure_reason': failure_reason,
                    'resources_cleaned': True
                }
            })

            logger.info(
                f"Document cleanup completed",
                extra={
                    'document_id': str(document_id),
                    'tenant_id': str(tenant_id),
                    'failure_reason': failure_reason
                }
            )

            return {
                'status': 'cleaned',
                'document_id': str(document_id),
                'timestamp': datetime.utcnow().isoformat()
            }

    except Exception as e:
        error_type = type(e).__name__
        ERROR_COUNTER.labels(
            error_type=error_type,
            tenant_id=str(tenant_id)
        ).inc()

        logger.error(
            f"Document cleanup error: {str(e)}",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'error_type': error_type
            },
            exc_info=True
        )
        raise