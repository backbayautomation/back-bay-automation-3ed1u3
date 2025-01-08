"""
Core document processing service implementing the document ingestion, OCR processing,
chunking, embedding generation, and vector indexing pipeline with enhanced monitoring
and error recovery capabilities.

Version: 1.0.0
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from datetime import datetime
from opentelemetry import trace
from prometheus_client import Counter, Histogram, Gauge
from celery import Task

from .ocr_service import OCRService
from .ai_service import AIService
from .vector_search import VectorSearchService
from ..models.document import Document, DocumentStatus
from ..models.chunk import Chunk
from ..models.embedding import Embedding
from ..utils.document_utils import validate_file_type, prepare_for_ocr, split_into_chunks
from ..core.config import settings

# Constants from technical specifications
CHUNK_SIZE = 1000  # Default chunk size
OVERLAP_SIZE = 100  # Chunk overlap size
BATCH_SIZE = 32    # Batch processing size
MAX_RETRIES = 3    # Maximum retry attempts
RETRY_DELAY = 5    # Delay between retries in seconds

# Configure logging
logger = logging.getLogger(__name__)

# Initialize metrics
PROCESSING_LATENCY = Histogram('document_processing_latency_seconds', 'Document processing latency')
OCR_LATENCY = Histogram('ocr_processing_latency_seconds', 'OCR processing latency')
EMBEDDING_LATENCY = Histogram('embedding_generation_latency_seconds', 'Embedding generation latency')
DOCUMENT_COUNTER = Counter('documents_processed_total', 'Total documents processed', ['status'])
ERROR_COUNTER = Counter('processing_errors_total', 'Processing errors', ['error_type'])
ACTIVE_DOCUMENTS = Gauge('documents_processing_active', 'Currently processing documents')

@trace.instrument_class
class DocumentProcessor:
    """Enhanced document processing service with monitoring and error recovery."""

    def __init__(
        self,
        ocr_service: OCRService,
        ai_service: AIService,
        vector_search: VectorSearchService,
        config: Dict[str, Any]
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
            'last_error': None,
            'last_error_time': None
        }
        
        logger.info(
            "Document processor initialized",
            extra={
                'config': config,
                'ocr_service': bool(ocr_service),
                'ai_service': bool(ai_service),
                'vector_search': bool(vector_search)
            }
        )

    @trace.instrument
    async def process_document(self, document: Document, tenant_id: str) -> Dict[str, Any]:
        """Process document through pipeline with enhanced monitoring and error recovery."""
        ACTIVE_DOCUMENTS.inc()
        start_time = datetime.utcnow()
        
        try:
            # Validate document
            is_valid, error_msg = await validate_file_type(document.filename)
            if not is_valid:
                await document.update_status(DocumentStatus.INVALID.value)
                raise ValueError(f"Document validation failed: {error_msg}")

            # Update document status
            await document.update_status(DocumentStatus.PROCESSING.value)
            
            # OCR Processing with monitoring
            with OCR_LATENCY.time():
                processed_chunks = await self._process_ocr(document, tenant_id)
            
            # Generate embeddings with batching
            with EMBEDDING_LATENCY.time():
                chunk_embeddings = await self._process_embeddings(processed_chunks, tenant_id)
            
            # Index embeddings
            await self._vector_search.batch_index(chunk_embeddings, tenant_id)
            
            # Update document status and metadata
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            await document.update_status(DocumentStatus.COMPLETED.value)
            await document.update_metadata({
                'processing_stats': {
                    'processing_time': processing_time,
                    'chunk_count': len(processed_chunks),
                    'embedding_count': len(chunk_embeddings),
                    'ocr_quality_score': np.mean([
                        chunk.metadata.get('ocr_confidence', 0) 
                        for chunk in processed_chunks
                    ])
                }
            })
            
            # Update metrics
            DOCUMENT_COUNTER.labels(status='completed').inc()
            
            return {
                'status': 'completed',
                'chunks_processed': len(processed_chunks),
                'embeddings_generated': len(chunk_embeddings),
                'processing_time': processing_time
            }

        except Exception as e:
            error_type = type(e).__name__
            ERROR_COUNTER.labels(error_type=error_type).inc()
            self._error_stats['last_error'] = str(e)
            self._error_stats['last_error_time'] = datetime.utcnow()
            
            logger.error(
                f"Document processing error: {str(e)}",
                extra={
                    'document_id': str(document.id),
                    'tenant_id': tenant_id,
                    'error_type': error_type
                },
                exc_info=True
            )
            
            await document.update_status(DocumentStatus.FAILED.value)
            DOCUMENT_COUNTER.labels(status='failed').inc()
            raise
        
        finally:
            ACTIVE_DOCUMENTS.dec()

    async def _process_ocr(self, document: Document, tenant_id: str) -> List[Chunk]:
        """Process document through OCR with error recovery."""
        try:
            # Prepare document for OCR
            image_tensor, preprocessing_metadata = await prepare_for_ocr(
                document,
                preprocessing_options={
                    'target_dpi': 300,
                    'enhance_contrast': True,
                    'reduce_noise': True
                }
            )
            
            # Process through OCR service
            chunks = await self._ocr_service.process_document(document)
            
            # Validate chunks
            if not chunks:
                raise ValueError("OCR processing produced no valid chunks")
            
            return chunks
            
        except Exception as e:
            self._error_stats['ocr_errors'] += 1
            logger.error(f"OCR processing error: {str(e)}", exc_info=True)
            raise

    async def _process_embeddings(
        self,
        chunks: List[Chunk],
        tenant_id: str
    ) -> List[Embedding]:
        """Generate embeddings for chunks with batch optimization."""
        embeddings = []
        
        try:
            # Process chunks in batches
            for i in range(0, len(chunks), BATCH_SIZE):
                batch = chunks[i:i + BATCH_SIZE]
                
                # Generate embeddings for batch
                batch_embeddings = await asyncio.gather(*[
                    self._generate_chunk_embedding(chunk, tenant_id)
                    for chunk in batch
                ])
                
                embeddings.extend([emb for emb in batch_embeddings if emb])
            
            return embeddings
            
        except Exception as e:
            self._error_stats['embedding_errors'] += 1
            logger.error(f"Embedding generation error: {str(e)}", exc_info=True)
            raise

    async def _generate_chunk_embedding(
        self,
        chunk: Chunk,
        tenant_id: str
    ) -> Optional[Embedding]:
        """Generate embedding for single chunk with error handling."""
        try:
            # Generate embedding vector
            embedding_vector = await self._ai_service.generate_embeddings(
                chunk.content,
                {
                    'chunk_id': str(chunk.id),
                    'sequence': chunk.sequence,
                    'tenant_id': tenant_id
                }
            )
            
            # Create embedding instance
            return Embedding(
                chunk_id=chunk.id,
                embedding_vector=embedding_vector,
                similarity_score=1.0,
                metadata={
                    'tenant_id': tenant_id,
                    'generated_at': datetime.utcnow().isoformat(),
                    'chunk_metadata': chunk.metadata
                }
            )
            
        except Exception as e:
            logger.error(
                f"Chunk embedding generation failed: {str(e)}",
                extra={
                    'chunk_id': str(chunk.id),
                    'tenant_id': tenant_id
                },
                exc_info=True
            )
            return None