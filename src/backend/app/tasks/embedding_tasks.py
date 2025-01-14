"""
Celery task module for handling asynchronous embedding generation and management operations.
Implements optimized batch processing, enhanced error handling, and secure multi-tenant isolation
for vector embeddings generation and management in the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

import logging
import numpy as np  # version: ^1.24.0
import openai  # version: ^1.3.0
from tenacity import retry, stop_after_attempt, wait_exponential  # version: ^8.2.0
from prometheus_client import Counter  # version: ^0.17.0
from typing import List, Dict
from uuid import UUID

from app.tasks.celery_app import celery_app
from app.services.vector_search import VectorSearchService
from app.models.embedding import Embedding

# Initialize logger
logger = logging.getLogger(__name__)

# Constants from technical specifications
BATCH_SIZE = 32
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536
MAX_RETRIES = 3
RETRY_DELAY = 5

# Initialize metrics
embedding_generation_counter = Counter(
    'embedding_generation_total',
    'Total number of embeddings generated',
    ['tenant_id', 'status']
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
    embedding_generation_counter.labels(tenant_id=str(tenant_id), status='started').inc()

    try:
        # Validate input chunks
        for chunk in chunks:
            if not chunk.get('content') or not chunk.get('chunk_id'):
                raise ValueError(f"Invalid chunk format: {chunk}")

        results = []
        # Process chunks in optimized batches
        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i:i + BATCH_SIZE]
            batch_texts = [chunk['content'] for chunk in batch]

            # Generate embeddings using OpenAI API
            response = openai.Embedding.create(
                model=EMBEDDING_MODEL,
                input=batch_texts
            )

            # Process and validate embeddings
            for j, embedding_data in enumerate(response['data']):
                vector = np.array(embedding_data['embedding'], dtype=np.float32)
                
                # Validate embedding dimension
                if vector.shape[0] != EMBEDDING_DIMENSION:
                    raise ValueError(f"Invalid embedding dimension: {vector.shape[0]}")

                # Create embedding instance with metadata
                embedding = Embedding(
                    chunk_id=batch[j]['chunk_id'],
                    embedding_vector=vector,
                    metadata={
                        'processing': {
                            'model_version': EMBEDDING_MODEL,
                            'processing_time': response['usage']['total_tokens'],
                            'quality_score': embedding_data['index']
                        }
                    }
                )

                results.append(embedding.to_dict())

        embedding_generation_counter.labels(tenant_id=str(tenant_id), status='success').inc()
        logger.info(f"Successfully generated {len(results)} embeddings for tenant {tenant_id}")
        return results

    except Exception as e:
        embedding_generation_counter.labels(tenant_id=str(tenant_id), status='error').inc()
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
    logger.info(f"Starting indexing of {len(embedding_ids)} embeddings for tenant {tenant_id}")

    try:
        # Fetch embeddings from database
        embeddings = Embedding.query.filter(
            Embedding.id.in_(embedding_ids),
            Embedding.chunk.has(tenant_id=tenant_id)
        ).all()

        if not embeddings:
            raise ValueError(f"No embeddings found for IDs: {embedding_ids}")

        # Initialize vector search service
        vector_service = VectorSearchService()

        # Batch index embeddings
        await vector_service.batch_index(embeddings, tenant_id)

        logger.info(f"Successfully indexed {len(embeddings)} embeddings for tenant {tenant_id}")
        return True

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
        vector_service.clear_index(tenant_id)

        logger.info(f"Successfully cleared embedding index for tenant {tenant_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to clear embedding index for tenant {tenant_id}: {str(e)}", exc_info=True)
        raise