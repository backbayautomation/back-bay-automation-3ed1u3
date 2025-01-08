"""
Celery task module for handling asynchronous embedding generation and management.
Implements optimized batch processing, enhanced error handling, and secure multi-tenant
isolation for vector embeddings in the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

import logging
import numpy as np  # version: 1.24.0
from uuid import UUID
from typing import List, Dict
from datetime import datetime

import openai  # version: 1.3.0
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.2.0
from prometheus_client import Counter  # version: 0.17.0

from app.tasks.celery_app import celery_app
from app.services.vector_search import VectorSearchService
from app.models.embedding import Embedding

# Configure logging
logger = logging.getLogger(__name__)

# Constants
BATCH_SIZE = 32  # As per technical specifications A.1.1
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536  # As per technical specifications A.1.1
MAX_RETRIES = 3
RETRY_DELAY = 5

# Prometheus metrics
embedding_generation_counter = Counter(
    'embedding_generation_total',
    'Total number of embeddings generated',
    ['tenant_id']
)

@celery_app.task(
    name='tasks.generate_embeddings',
    queue='embedding',
    retry_backoff=True,
    max_retries=MAX_RETRIES
)
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=RETRY_DELAY)
)
def generate_embeddings(chunks: List[Dict], tenant_id: UUID) -> List[Dict]:
    """
    Generate embeddings for document chunks with enhanced error handling and monitoring.

    Args:
        chunks: List of document chunks with content and metadata
        tenant_id: Tenant identifier for isolation

    Returns:
        List of generated embeddings with metadata and validation status
    """
    logger.info(f"Starting embedding generation for {len(chunks)} chunks, tenant: {tenant_id}")
    results = []

    try:
        # Validate input chunks
        if not chunks or not isinstance(chunks, list):
            raise ValueError("Invalid chunks input")

        # Process chunks in optimized batches
        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i:i + BATCH_SIZE]
            batch_texts = [chunk['content'] for chunk in batch]

            try:
                # Generate embeddings with OpenAI API
                response = openai.Embedding.create(
                    input=batch_texts,
                    model=EMBEDDING_MODEL
                )

                # Process and validate embeddings
                for j, embedding_data in enumerate(response['data']):
                    vector = np.array(embedding_data['embedding'], dtype=np.float32)
                    
                    # Validate embedding dimension
                    if vector.shape[0] != EMBEDDING_DIMENSION:
                        raise ValueError(f"Invalid embedding dimension: {vector.shape[0]}")

                    # Create embedding instance with tenant isolation
                    embedding = Embedding(
                        chunk_id=batch[j]['chunk_id'],
                        embedding_vector=vector,
                        similarity_score=0.0,
                        metadata={
                            'processing_info': {
                                'model': EMBEDDING_MODEL,
                                'timestamp': datetime.utcnow().isoformat(),
                                'batch_id': i // BATCH_SIZE
                            },
                            'chunk_metadata': batch[j].get('metadata', {})
                        }
                    )

                    results.append({
                        'chunk_id': str(batch[j]['chunk_id']),
                        'embedding_id': str(embedding.id),
                        'status': 'success',
                        'metadata': embedding.metadata
                    })

                    # Update metrics
                    embedding_generation_counter.labels(tenant_id=str(tenant_id)).inc()

            except Exception as e:
                logger.error(f"Batch processing error: {str(e)}", exc_info=True)
                # Mark failed chunks but continue processing
                for chunk in batch:
                    results.append({
                        'chunk_id': str(chunk['chunk_id']),
                        'status': 'failed',
                        'error': str(e)
                    })

        logger.info(f"Completed embedding generation for tenant {tenant_id}")
        return results

    except Exception as e:
        logger.error(f"Embedding generation failed for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise

@celery_app.task(
    name='tasks.index_embeddings',
    queue='embedding',
    retry_backoff=True
)
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=RETRY_DELAY)
)
def index_embeddings(embedding_ids: List[UUID], tenant_id: UUID) -> bool:
    """
    Index embeddings in vector search service with tenant isolation.

    Args:
        embedding_ids: List of embedding IDs to index
        tenant_id: Tenant identifier for isolation

    Returns:
        Success status with validation results
    """
    logger.info(f"Starting embedding indexing for tenant {tenant_id}")

    try:
        # Validate input
        if not embedding_ids:
            raise ValueError("No embedding IDs provided")

        # Initialize vector search service
        vector_service = VectorSearchService()

        # Batch index embeddings
        success = vector_service.batch_index(embedding_ids, tenant_id)

        logger.info(f"Completed embedding indexing for tenant {tenant_id}")
        return success

    except Exception as e:
        logger.error(f"Embedding indexing failed for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise

@celery_app.task(
    name='tasks.clear_embedding_index',
    queue='embedding'
)
@retry(stop=stop_after_attempt(3))
def clear_embedding_index(tenant_id: UUID) -> bool:
    """
    Clear vector search index with tenant isolation.

    Args:
        tenant_id: Tenant identifier for isolation

    Returns:
        Success status
    """
    logger.info(f"Clearing embedding index for tenant {tenant_id}")

    try:
        # Initialize vector search service
        vector_service = VectorSearchService()

        # Clear tenant-specific index
        success = vector_service.clear_index(tenant_id)

        logger.info(f"Cleared embedding index for tenant {tenant_id}")
        return success

    except Exception as e:
        logger.error(f"Failed to clear embedding index for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise