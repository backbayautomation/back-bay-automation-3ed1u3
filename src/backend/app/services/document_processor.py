"""
Core service module implementing the document processing pipeline for the AI-powered Product Catalog Search System.
Provides GPU-accelerated document processing with comprehensive monitoring and error recovery.

Version: 1.0.0
"""

import asyncio
import logging
from typing import Dict, List, Optional
import opentelemetry.trace
from celery import Task
from prometheus_client import Counter, Histogram, Gauge

from .ocr_service import OCRService
from .ai_service import AIService
from .vector_search import VectorSearchService
from ..models.document import Document, DocumentStatus
from ..utils.document_utils import validate_file_type, prepare_for_ocr, split_into_chunks

# Initialize logger
logger = logging.getLogger(__name__)

# Global constants
CHUNK_SIZE = 1000
OVERLAP_SIZE = 100
BATCH_SIZE = 32
MAX_RETRIES = 3
RETRY_DELAY = 5

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

@opentelemetry.trace.instrument_class
class DocumentProcessor:
    """Enhanced service class implementing the document processing pipeline with monitoring and error recovery."""

    def __init__(
        self,
        ocr_service: OCRService,
        ai_service: AIService,
        vector_search: VectorSearchService,
        config: Dict
    ):
        """Initialize document processor with required services and monitoring."""
        self._ocr_service = ocr_service
        self._ai_service = ai_service
        self._vector_search = vector_search
        self._config = config
        
        # Initialize error tracking
        self._error_stats = {
            'ocr_errors': 0,
            'embedding_errors': 0,
            'indexing_errors': 0,
            'total_retries': 0
        }
        
        logger.info(
            "Document processor initialized",
            extra={'config': config}
        )

    @opentelemetry.trace.instrument
    async def process_document(self, document: Document, tenant_id: str) -> Dict:
        """Process document through pipeline with enhanced monitoring and error recovery."""
        ACTIVE_DOCUMENTS.inc()
        processing_start = asyncio.get_event_loop().time()
        
        try:
            # Validate document and tenant isolation
            is_valid, error_msg = validate_file_type(document.filename)
            if not is_valid:
                PROCESSING_ERRORS.labels(error_type='validation').inc()
                await document.update_status(DocumentStatus.INVALID.value)
                raise ValueError(f"Invalid document: {error_msg}")

            # Update document status
            await document.update_status(DocumentStatus.PROCESSING.value)
            
            # Process document with OCR
            with PROCESSING_DURATION.time():
                # Prepare document for OCR
                image_tensor, preprocessing_metadata = await prepare_for_ocr(
                    document,
                    self._config.get('preprocessing_options', {})
                )
                
                # Extract text using OCR with retries
                chunks = await self._process_with_retries(
                    self._ocr_service.process_document,
                    document,
                    max_retries=MAX_RETRIES
                )
                
                # Generate embeddings for chunks
                embeddings = await self._process_chunks(chunks, tenant_id)
                
                # Index embeddings
                await self._vector_search.batch_index(embeddings, tenant_id)
            
            # Update document status and metadata
            processing_time = asyncio.get_event_loop().time() - processing_start
            await document.update_metadata({
                'processing': {
                    'duration': processing_time,
                    'chunk_count': len(chunks),
                    'embedding_count': len(embeddings),
                    'preprocessing': preprocessing_metadata
                }
            })
            await document.update_status(DocumentStatus.COMPLETED.value)
            
            logger.info(
                "Document processed successfully",
                extra={
                    'document_id': str(document.id),
                    'tenant_id': tenant_id,
                    'processing_time': processing_time
                }
            )
            
            return {
                'status': 'success',
                'document_id': str(document.id),
                'chunks_processed': len(chunks),
                'embeddings_generated': len(embeddings),
                'processing_time': processing_time
            }
            
        except Exception as e:
            PROCESSING_ERRORS.labels(error_type='processing').inc()
            logger.error(
                f"Document processing failed: {str(e)}",
                extra={
                    'document_id': str(document.id),
                    'tenant_id': tenant_id,
                    'error': str(e)
                },
                exc_info=True
            )
            await document.update_status(DocumentStatus.FAILED.value)
            raise
            
        finally:
            ACTIVE_DOCUMENTS.dec()

    async def _process_with_retries(self, func, *args, max_retries: int = MAX_RETRIES):
        """Execute function with retry mechanism and exponential backoff."""
        for attempt in range(max_retries):
            try:
                return await func(*args)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                    
                self._error_stats['total_retries'] += 1
                retry_delay = RETRY_DELAY * (2 ** attempt)
                
                logger.warning(
                    f"Operation failed, retrying in {retry_delay}s",
                    extra={
                        'attempt': attempt + 1,
                        'max_retries': max_retries,
                        'error': str(e)
                    }
                )
                
                await asyncio.sleep(retry_delay)

    @opentelemetry.trace.instrument
    async def _process_chunks(self, chunks: List[str], tenant_id: str) -> List:
        """Process chunks through embedding generation with optimization."""
        embeddings = []
        
        try:
            # Process chunks in optimized batches
            for i in range(0, len(chunks), BATCH_SIZE):
                batch = chunks[i:i + BATCH_SIZE]
                
                # Generate embeddings with monitoring
                batch_embeddings = await asyncio.gather(*[
                    self._ai_service.generate_embeddings(
                        chunk.content,
                        {
                            'tenant_id': tenant_id,
                            'chunk_id': str(chunk.id),
                            'sequence': chunk.sequence
                        }
                    )
                    for chunk in batch
                ])
                
                embeddings.extend(batch_embeddings)
                
                logger.debug(
                    f"Processed batch of {len(batch)} chunks",
                    extra={
                        'tenant_id': tenant_id,
                        'batch_size': len(batch),
                        'total_processed': len(embeddings)
                    }
                )
            
            return embeddings
            
        except Exception as e:
            self._error_stats['embedding_errors'] += 1
            logger.error(
                "Chunk processing failed",
                extra={
                    'tenant_id': tenant_id,
                    'error': str(e)
                },
                exc_info=True
            )
            raise

    async def chunk_text(self, text: str, preserve_layout: bool = True) -> List[str]:
        """Split document text into overlapping chunks with enhanced validation."""
        try:
            chunks = split_into_chunks(
                text,
                chunk_size=CHUNK_SIZE,
                overlap_ratio=OVERLAP_SIZE/CHUNK_SIZE,
                chunking_options={'preserve_layout': preserve_layout}
            )
            
            logger.debug(
                f"Text split into {len(chunks)} chunks",
                extra={
                    'chunk_count': len(chunks),
                    'average_chunk_size': sum(len(c['content']) for c in chunks) / len(chunks)
                }
            )
            
            return chunks
            
        except Exception as e:
            logger.error(
                "Text chunking failed",
                extra={'error': str(e)},
                exc_info=True
            )
            raise

    async def get_processing_stats(self) -> Dict:
        """Get comprehensive processing statistics and metrics."""
        return {
            'error_stats': self._error_stats,
            'active_documents': ACTIVE_DOCUMENTS._value.get(),
            'processing_errors': {
                'validation': PROCESSING_ERRORS.labels(error_type='validation')._value.get(),
                'processing': PROCESSING_ERRORS.labels(error_type='processing')._value.get()
            },
            'average_duration': PROCESSING_DURATION._sum.get() / max(PROCESSING_DURATION._count.get(), 1)
        }