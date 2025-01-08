"""
Core service module implementing the document processing pipeline for the AI-powered Product Catalog Search System.
Provides GPU-accelerated document processing with comprehensive monitoring and error recovery.

Version: 1.0.0
"""

import asyncio  # version: latest
import celery  # version: 5.3.0
import logging  # version: latest
from opentelemetry import trace  # version: 1.20.0
from prometheus_client import Counter, Histogram, Gauge  # version: 0.17.0
from typing import List, Dict, Optional, Tuple
import numpy as np

from .ocr_service import OCRService
from .ai_service import AIService
from .vector_search import VectorSearchService
from ..models.document import Document
from ..models.chunk import Chunk
from ..utils.document_utils import validate_file_type, prepare_for_ocr, split_into_chunks

# Configure logging
logger = logging.getLogger(__name__)

# Constants
CHUNK_SIZE = 1000
OVERLAP_SIZE = 100
BATCH_SIZE = 32
MAX_RETRIES = 3
RETRY_DELAY = 5

# Prometheus metrics
PROCESSING_REQUESTS = Counter('document_processing_requests_total', 'Total document processing requests')
PROCESSING_ERRORS = Counter('document_processing_errors_total', 'Total processing errors')
PROCESSING_DURATION = Histogram('document_processing_duration_seconds', 'Document processing duration')
OCR_QUALITY = Gauge('ocr_quality_score', 'OCR processing quality score')
CHUNK_COUNT = Gauge('document_chunk_count', 'Number of chunks per document')

@trace.instrument_class
class DocumentProcessor:
    """Enhanced service class implementing the document processing pipeline with monitoring and error recovery."""

    def __init__(
        self,
        ocr_service: OCRService,
        ai_service: AIService,
        vector_search: VectorSearchService,
        config: Dict
    ):
        """
        Initialize document processor with required services and monitoring.

        Args:
            ocr_service: OCR processing service instance
            ai_service: AI service for embedding generation
            vector_search: Vector search service for indexing
            config: Configuration dictionary
        """
        self._ocr_service = ocr_service
        self._ai_service = ai_service
        self._vector_search = vector_search
        self._config = config
        
        # Initialize error tracking
        self._error_stats = {
            'total_errors': 0,
            'ocr_errors': 0,
            'embedding_errors': 0,
            'indexing_errors': 0,
            'last_error': None
        }

        logger.info(
            "Document processor initialized",
            extra={
                'config': config,
                'chunk_size': CHUNK_SIZE,
                'batch_size': BATCH_SIZE
            }
        )

    @trace.instrument
    async def process_document(self, document: Document, tenant_id: str) -> Dict:
        """
        Process document through pipeline with enhanced monitoring and error recovery.

        Args:
            document: Document model instance to process
            tenant_id: Client/tenant identifier

        Returns:
            Dict containing processing results and metrics

        Raises:
            RuntimeError: If document processing fails
        """
        PROCESSING_REQUESTS.inc()
        processing_start = asyncio.get_event_loop().time()

        try:
            # Validate document
            is_valid, error_msg = validate_file_type(document.filename)
            if not is_valid:
                raise ValueError(f"Invalid document: {error_msg}")

            # Update document status
            await document.update_status('processing')

            # OCR Processing with retries
            text_chunks = []
            retry_count = 0
            while retry_count < MAX_RETRIES:
                try:
                    # Prepare document for OCR
                    image_tensor, preprocessing_metadata = await prepare_for_ocr(document)
                    
                    # Process through OCR
                    processed_chunks = await self._ocr_service.process_document(document)
                    
                    # Extract text content
                    for chunk in processed_chunks:
                        text_chunks.append(chunk.content)
                    
                    OCR_QUALITY.set(
                        float(np.mean([c.metadata['ocr_confidence'] for c in processed_chunks]))
                    )
                    break

                except Exception as e:
                    retry_count += 1
                    self._error_stats['ocr_errors'] += 1
                    if retry_count == MAX_RETRIES:
                        raise RuntimeError(f"OCR processing failed after {MAX_RETRIES} attempts: {str(e)}")
                    await asyncio.sleep(RETRY_DELAY)

            # Split into semantic chunks
            document_chunks = []
            for text in text_chunks:
                chunks = await self.chunk_text(text, preserve_layout=True)
                document_chunks.extend(chunks)

            CHUNK_COUNT.set(len(document_chunks))

            # Generate embeddings with batch optimization
            embeddings = await self.process_chunks(document_chunks, tenant_id)

            # Index embeddings
            await self._vector_search.batch_index(embeddings, tenant_id)

            # Update document status and metadata
            processing_time = asyncio.get_event_loop().time() - processing_start
            await document.update_status('completed')
            await document.update_metadata({
                'processing_time': processing_time,
                'chunk_count': len(document_chunks),
                'embedding_count': len(embeddings),
                'ocr_quality': float(OCR_QUALITY._value.get()),
                'processing_successful': True
            })

            PROCESSING_DURATION.observe(processing_time)

            return {
                'status': 'completed',
                'document_id': str(document.id),
                'chunks_processed': len(document_chunks),
                'embeddings_generated': len(embeddings),
                'processing_time': processing_time,
                'metrics': {
                    'ocr_quality': float(OCR_QUALITY._value.get()),
                    'chunk_count': len(document_chunks),
                    'processing_duration': processing_time
                }
            }

        except Exception as e:
            self._error_stats['total_errors'] += 1
            self._error_stats['last_error'] = str(e)
            PROCESSING_ERRORS.inc()

            logger.error(
                f"Document processing failed: {str(e)}",
                extra={
                    'document_id': str(document.id),
                    'tenant_id': tenant_id,
                    'error_type': type(e).__name__,
                    'error_details': str(e)
                },
                exc_info=True
            )

            # Update document status to failed
            await document.update_status('failed')
            await document.update_metadata({
                'error': str(e),
                'error_type': type(e).__name__,
                'processing_successful': False
            })

            raise RuntimeError(f"Document processing failed: {str(e)}")

    async def chunk_text(self, text: str, preserve_layout: bool = True) -> List[str]:
        """
        Split document text into overlapping chunks with enhanced validation.

        Args:
            text: Input text to chunk
            preserve_layout: Whether to preserve document layout

        Returns:
            List of validated text chunks
        """
        try:
            # Validate input
            if not text or not isinstance(text, str):
                raise ValueError("Invalid input text")

            # Generate chunks with overlap
            chunks = split_into_chunks(
                text,
                chunk_size=CHUNK_SIZE,
                overlap_ratio=OVERLAP_SIZE/CHUNK_SIZE,
                chunking_options={'preserve_layout': preserve_layout}
            )

            # Validate chunks
            validated_chunks = []
            for chunk in chunks:
                if len(chunk['content'].strip()) > 0:
                    validated_chunks.append(chunk['content'])

            logger.debug(
                "Text chunking completed",
                extra={
                    'chunk_count': len(validated_chunks),
                    'average_chunk_size': np.mean([len(c) for c in validated_chunks])
                }
            )

            return validated_chunks

        except Exception as e:
            logger.error(f"Text chunking failed: {str(e)}")
            raise

    @trace.instrument
    async def process_chunks(self, chunks: List[str], tenant_id: str) -> List[np.ndarray]:
        """
        Process chunks through embedding generation with optimization.

        Args:
            chunks: List of text chunks
            tenant_id: Client/tenant identifier

        Returns:
            List of embeddings with quality metrics
        """
        try:
            embeddings = []
            
            # Process chunks in optimized batches
            for i in range(0, len(chunks), BATCH_SIZE):
                batch = chunks[i:i + BATCH_SIZE]
                
                # Generate embeddings for batch
                batch_embeddings = await asyncio.gather(*[
                    self._ai_service.generate_embeddings(
                        chunk,
                        {
                            'batch_index': i,
                            'chunk_index': j,
                            'tenant_id': tenant_id
                        }
                    )
                    for j, chunk in enumerate(batch)
                ])
                
                embeddings.extend(batch_embeddings)

            logger.info(
                "Chunk processing completed",
                extra={
                    'total_chunks': len(chunks),
                    'embeddings_generated': len(embeddings),
                    'tenant_id': tenant_id
                }
            )

            return embeddings

        except Exception as e:
            self._error_stats['embedding_errors'] += 1
            logger.error(
                f"Chunk processing failed: {str(e)}",
                extra={'tenant_id': tenant_id, 'chunk_count': len(chunks)}
            )
            raise