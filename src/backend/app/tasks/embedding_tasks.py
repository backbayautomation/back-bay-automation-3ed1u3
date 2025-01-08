"""
Celery task module for handling asynchronous embedding generation and management operations.
Implements optimized batch processing, enhanced error handling, and secure multi-tenant isolation.

Version: 1.0.0
"""

import logging
import numpy as np  # version: ^1.24.0
from uuid import UUID
from typing import List, Dict
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential  # version: ^8.2.0
import openai  # version: ^1.3.0
from prometheus_client import Counter  # version: ^0.17.0

from app.tasks.celery_app import celery_app
from app.services.vector_search import VectorSearchService
from app.models.embedding import Embedding

# Configure module logger
logger = logging.getLogger(__name__)

# Constants from technical specifications
BATCH_SIZE = 32
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_DIMENSION = 1536
MAX_RETRIES = 3
RETRY_DELAY = 5

# Prometheus metrics
embedding_generation_counter = Counter(
    'embedding_generation_total',
    'Total number of embeddings generated'
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
        chunks: List of document chunks to process
        tenant_id: Client/tenant identifier for isolation

    Returns:
        List of generated embeddings with metadata and validation status
    """
    logger.info(
        "Starting embedding generation task",
        extra={
            'tenant_id': str(tenant_id),
            'chunk_count': len(chunks),
            'batch_size': BATCH_SIZE
        }
    )

    results = []
    start_time = datetime.utcnow()

    try:
        # Process chunks in optimized batches
        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i:i + BATCH_SIZE]
            batch_texts = [chunk['content'] for chunk in batch]

            # Generate embeddings with OpenAI API
            response = openai.Embedding.create(
                input=batch_texts,
                model=EMBEDDING_MODEL
            )

            # Process and validate embeddings
            for j, embedding_data in enumerate(response['data']):
                chunk = batch[j]
                embedding_vector = np.array(embedding_data['embedding'])

                # Validate embedding dimension
                if embedding_vector.shape[0] != EMBEDDING_DIMENSION:
                    logger.error(
                        "Invalid embedding dimension",
                        extra={
                            'tenant_id': str(tenant_id),
                            'chunk_id': chunk.get('id'),
                            'expected_dim': EMBEDDING_DIMENSION,
                            'actual_dim': embedding_vector.shape[0]
                        }
                    )
                    continue

                # Create embedding instance with metadata
                embedding = Embedding(
                    chunk_id=chunk['id'],
                    embedding_vector=embedding_vector,
                    metadata={
                        'model': EMBEDDING_MODEL,
                        'processing_time': (datetime.utcnow() - start_time).total_seconds(),
                        'token_count': embedding_data['token_count']
                    }
                )

                results.append(embedding.to_dict())
                embedding_generation_counter.inc()

            logger.info(
                f"Processed batch of {len(batch)} chunks",
                extra={
                    'tenant_id': str(tenant_id),
                    'batch_index': i // BATCH_SIZE
                }
            )

        return results

    except Exception as e:
        logger.error(
            "Embedding generation failed",
            extra={
                'tenant_id': str(tenant_id),
                'error': str(e),
                'error_type': type(e).__name__
            }
        )
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
        tenant_id: Client/tenant identifier for isolation

    Returns:
        Success status with validation results
    """
    logger.info(
        "Starting embedding indexing task",
        extra={
            'tenant_id': str(tenant_id),
            'embedding_count': len(embedding_ids)
        }
    )

    try:
        # Fetch embeddings from database
        embeddings = Embedding.query.filter(
            Embedding.id.in_(embedding_ids)
        ).all()

        # Validate embeddings
        valid_embeddings = []
        for emb in embeddings:
            vector = emb.get_vector()
            if vector.shape[0] == EMBEDDING_DIMENSION:
                valid_embeddings.append(emb)
            else:
                logger.warning(
                    "Invalid embedding dimension detected",
                    extra={
                        'tenant_id': str(tenant_id),
                        'embedding_id': str(emb.id),
                        'dimension': vector.shape[0]
                    }
                )

        # Index valid embeddings
        if valid_embeddings:
            vector_service = VectorSearchService()
            vector_service.batch_index(valid_embeddings, tenant_id)

            logger.info(
                "Successfully indexed embeddings",
                extra={
                    'tenant_id': str(tenant_id),
                    'indexed_count': len(valid_embeddings)
                }
            )
            return True

        return False

    except Exception as e:
        logger.error(
            "Embedding indexing failed",
            extra={
                'tenant_id': str(tenant_id),
                'error': str(e),
                'error_type': type(e).__name__
            }
        )
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
        tenant_id: Client/tenant identifier for isolation

    Returns:
        Success status
    """
    logger.info(
        "Starting index clearing task",
        extra={'tenant_id': str(tenant_id)}
    )

    try:
        vector_service = VectorSearchService()
        vector_service.clear_index(tenant_id)

        logger.info(
            "Successfully cleared embedding index",
            extra={'tenant_id': str(tenant_id)}
        )
        return True

    except Exception as e:
        logger.error(
            "Index clearing failed",
            extra={
                'tenant_id': str(tenant_id),
                'error': str(e),
                'error_type': type(e).__name__
            }
        )
        raise