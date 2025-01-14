"""
Celery task module implementing enterprise-grade asynchronous document processing tasks.
Handles multi-format document ingestion, GPU-accelerated OCR processing, chunking, and vector indexing
with comprehensive monitoring, error handling, and multi-tenant isolation.

Version: 1.0.0
"""

import logging
import asyncio
from uuid import UUID
from datetime import datetime
from typing import Dict, Optional
from prometheus_client import Counter, Histogram, Gauge

from celery import Task
from app.tasks.celery_app import task
from app.services.document_processor import DocumentProcessor
from app.models.document import Document, VALID_STATUSES
from app.core.config import settings

# Initialize logger
logger = logging.getLogger(__name__)

# Global constants from settings
RETRY_BACKOFF = 300  # 5 minutes
MAX_RETRIES = 3
BATCH_SIZE = 32
MAX_DOCUMENT_SIZE_MB = 100
PROCESSING_TIMEOUT = 600  # 10 minutes

# Initialize Prometheus metrics
PROCESSING_DURATION = Histogram(
    'document_processing_duration_seconds',
    'Time spent processing documents'
)
PROCESSING_ERRORS = Counter(
    'document_processing_errors_total',
    'Total number of document processing errors',
    ['error_type']
)
ACTIVE_DOCUMENTS = Gauge(
    'document_processing_active',
    'Number of documents currently being processed'
)

class DocumentProcessingTask(Task):
    """Base task class with enhanced error handling and monitoring."""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Handle task failure with comprehensive error tracking."""
        PROCESSING_ERRORS.labels(error_type='task_failure').inc()
        
        logger.error(
            f"Document processing task failed: {str(exc)}",
            extra={
                'task_id': task_id,
                'args': args,
                'kwargs': kwargs,
                'exception': str(exc),
                'traceback': einfo.traceback if einfo else None
            }
        )
        
        # Attempt to update document status
        try:
            document_id = args[0] if args else kwargs.get('document_id')
            if document_id:
                document = Document.query.get(document_id)
                if document:
                    document.update_status('failed')
                    document.update_metadata({
                        'error': str(exc),
                        'failure_time': datetime.utcnow().isoformat()
                    })
        except Exception as e:
            logger.error(f"Failed to update document status: {str(e)}")

@task(
    bind=True,
    base=DocumentProcessingTask,
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
        document_id: UUID of document to process
        tenant_id: UUID of tenant for isolation
        processing_options: Optional processing configuration
        
    Returns:
        Dict containing processing results and metrics
        
    Raises:
        Exception: If processing fails after retries
    """
    ACTIVE_DOCUMENTS.inc()
    processing_start = datetime.utcnow()
    
    try:
        # Initialize document processor
        document_processor = DocumentProcessor(
            ocr_service=settings.get_ocr_service(),
            ai_service=settings.get_ai_service(),
            vector_search=settings.get_vector_search_service(),
            config=processing_options or {}
        )
        
        # Retrieve document with tenant validation
        document = Document.query.get(document_id)
        if not document or str(document.client.org_id) != str(tenant_id):
            raise ValueError("Invalid document or tenant ID")
            
        # Validate document size
        if document.metadata.get('file_size', 0) > MAX_DOCUMENT_SIZE_MB * 1024 * 1024:
            raise ValueError(f"Document exceeds maximum size of {MAX_DOCUMENT_SIZE_MB}MB")
            
        # Update document status
        await document.update_status('processing')
        await document.update_metadata({
            'processing_start': processing_start.isoformat(),
            'processor_version': '1.0.0'
        })
        
        # Process document with monitoring
        with PROCESSING_DURATION.time():
            processing_result = await document_processor.process_document(
                document=document,
                tenant_id=str(tenant_id)
            )
            
        # Update document status and metadata
        processing_time = (datetime.utcnow() - processing_start).total_seconds()
        await document.update_status('completed')
        await document.update_metadata({
            'processing_end': datetime.utcnow().isoformat(),
            'processing_time': processing_time,
            'chunks_processed': processing_result.get('chunks_processed', 0),
            'embeddings_generated': processing_result.get('embeddings_generated', 0)
        })
        
        logger.info(
            "Document processed successfully",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'processing_time': processing_time
            }
        )
        
        return {
            'status': 'success',
            'document_id': str(document_id),
            'processing_time': processing_time,
            'metrics': processing_result
        }
        
    except Exception as e:
        PROCESSING_ERRORS.labels(error_type='processing').inc()
        logger.error(
            f"Document processing failed: {str(e)}",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'error': str(e)
            },
            exc_info=True
        )
        
        # Retry task if attempts remain
        if self.request.retries < MAX_RETRIES:
            raise self.retry(
                exc=e,
                countdown=RETRY_BACKOFF * (2 ** self.request.retries)
            )
            
        # Update document status on final failure
        await cleanup_failed_document_task.delay(
            document_id=document_id,
            tenant_id=tenant_id,
            failure_reason=str(e)
        )
        
        raise
        
    finally:
        ACTIVE_DOCUMENTS.dec()

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
        document_id: UUID of failed document
        tenant_id: UUID of tenant
        failure_reason: Reason for failure
        
    Returns:
        Dict containing cleanup status
    """
    try:
        # Retrieve document with tenant validation
        document = Document.query.get(document_id)
        if not document or str(document.client.org_id) != str(tenant_id):
            raise ValueError("Invalid document or tenant ID")
            
        # Update document status
        await document.update_status('failed')
        await document.update_metadata({
            'failure_reason': failure_reason,
            'failure_time': datetime.utcnow().isoformat(),
            'cleanup_performed': True
        })
        
        # Release GPU resources if held
        document_processor = DocumentProcessor(
            ocr_service=settings.get_ocr_service(),
            ai_service=settings.get_ai_service(),
            vector_search=settings.get_vector_search_service(),
            config={}
        )
        await document_processor.cleanup_resources(document_id)
        
        logger.info(
            "Failed document cleanup completed",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'failure_reason': failure_reason
            }
        )
        
        return {
            'status': 'success',
            'document_id': str(document_id),
            'cleanup_time': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(
            f"Document cleanup failed: {str(e)}",
            extra={
                'document_id': str(document_id),
                'tenant_id': str(tenant_id),
                'error': str(e)
            },
            exc_info=True
        )
        raise