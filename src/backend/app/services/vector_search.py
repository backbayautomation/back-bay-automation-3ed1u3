"""
Vector similarity search service implementation for the AI-powered Product Catalog Search System.
Provides efficient semantic search capabilities with tenant isolation, monitoring, and caching.

Version: 1.0.0
"""

import logging
import numpy as np  # version: ^1.24.0
from typing import List, Dict, Optional
import faiss  # version: ^1.7.4
from redis import Redis  # version: ^4.5.0
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_exponential  # version: ^8.2.0
from prometheus_client import Counter, Histogram, Gauge  # version: ^0.16.0

from app.models.embedding import Embedding
from app.models.chunk import Chunk
from app.core.config import settings
from app.constants import VectorSearchConfig

# Configure module logger
logger = logging.getLogger(__name__)

# Prometheus metrics
SEARCH_REQUESTS = Counter('vector_search_requests_total', 'Total number of vector search requests')
SEARCH_LATENCY = Histogram('vector_search_latency_seconds', 'Vector search latency in seconds')
CACHE_HITS = Counter('vector_search_cache_hits_total', 'Number of cache hits')
CACHE_MISSES = Counter('vector_search_cache_misses_total', 'Number of cache misses')
INDEX_SIZE = Gauge('vector_search_index_size', 'Number of vectors in the index')

class VectorSearchService:
    """
    Service class implementing vector similarity search with enhanced monitoring,
    tenant isolation, and caching capabilities.
    """

    def __init__(self, db_session: Session, cache_client: Redis, config: Dict = None):
        """
        Initialize vector search service with configuration and connections.

        Args:
            db_session: SQLAlchemy session for database operations
            cache_client: Redis client for caching
            config: Optional configuration override
        """
        self.db = db_session
        self._cache = cache_client
        
        # Load configuration
        vector_config = config or settings.get_vector_search_settings()
        self.VECTOR_DIMENSION = vector_config.get('dimension', VectorSearchConfig.VECTOR_DIMENSION.value)
        self.TOP_K = vector_config.get('top_k_results', VectorSearchConfig.TOP_K_RESULTS.value)
        self.SIMILARITY_THRESHOLD = vector_config.get('similarity_threshold', 
                                                    VectorSearchConfig.SIMILARITY_THRESHOLD.value)
        self.BATCH_SIZE = vector_config.get('batch_size', VectorSearchConfig.BATCH_SIZE.value)

        # Initialize FAISS index with GPU support if available
        try:
            res = faiss.StandardGpuResources()
            config = faiss.GpuIndexFlatIPConfig()
            config.device = 0
            self._index = faiss.GpuIndexFlatIP(res, self.VECTOR_DIMENSION, config)
            logger.info("GPU-enabled FAISS index initialized successfully")
        except Exception as e:
            logger.warning(f"GPU initialization failed, falling back to CPU: {str(e)}")
            self._index = faiss.IndexFlatIP(self.VECTOR_DIMENSION)

        # Initialize tenant-specific indices
        self._tenant_indices = {}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    def search(self, query_embedding: np.ndarray, tenant_id: str, 
              top_k: Optional[int] = None, threshold: Optional[float] = None) -> List[Dict]:
        """
        Perform vector similarity search with tenant isolation and caching.

        Args:
            query_embedding: Query vector
            tenant_id: Client/tenant identifier
            top_k: Optional override for number of results
            threshold: Optional override for similarity threshold

        Returns:
            List of similar chunks with scores and metadata
        """
        SEARCH_REQUESTS.inc()
        with SEARCH_LATENCY.time():
            try:
                # Parameter validation
                if query_embedding.shape[0] != self.VECTOR_DIMENSION:
                    raise ValueError(f"Query embedding must have dimension {self.VECTOR_DIMENSION}")

                top_k = top_k or self.TOP_K
                threshold = threshold or self.SIMILARITY_THRESHOLD

                # Check cache
                cache_key = f"search:{tenant_id}:{hash(query_embedding.tobytes())}"
                cached_result = self._cache.get(cache_key)
                if cached_result:
                    CACHE_HITS.inc()
                    return cached_result

                CACHE_MISSES.inc()

                # Normalize query vector
                faiss.normalize_L2(query_embedding.reshape(1, -1))

                # Get tenant-specific embeddings
                embeddings = self.db.query(Embedding).join(Chunk).filter(
                    Chunk.document.has(client_id=tenant_id)
                ).all()

                if not embeddings:
                    logger.warning(f"No embeddings found for tenant {tenant_id}")
                    return []

                # Perform similarity search
                vectors = np.vstack([emb.get_vector() for emb in embeddings])
                faiss.normalize_L2(vectors)
                
                scores, indices = self._index.search(query_embedding.reshape(1, -1), top_k)
                
                # Filter results by threshold
                results = []
                for score, idx in zip(scores[0], indices[0]):
                    if score < threshold:
                        continue
                        
                    embedding = embeddings[idx]
                    chunk = embedding.chunk
                    
                    result = {
                        'chunk_id': str(chunk.id),
                        'document_id': str(chunk.document_id),
                        'content': chunk.content,
                        'similarity_score': float(score),
                        'metadata': chunk.metadata
                    }
                    results.append(result)

                # Cache results
                self._cache.setex(
                    cache_key,
                    300,  # 5 minute TTL
                    results
                )

                return results

            except Exception as e:
                logger.error(f"Vector search error: {str(e)}", 
                           extra={'tenant_id': tenant_id, 'error': str(e)})
                raise

    def batch_index(self, embeddings: List[Embedding], tenant_id: str) -> None:
        """
        Index batch of embeddings with optimized processing.

        Args:
            embeddings: List of embedding instances to index
            tenant_id: Client/tenant identifier
        """
        try:
            if not embeddings:
                return

            # Process in batches
            for i in range(0, len(embeddings), self.BATCH_SIZE):
                batch = embeddings[i:i + self.BATCH_SIZE]
                
                # Extract and normalize vectors
                vectors = np.vstack([emb.get_vector() for emb in batch])
                faiss.normalize_L2(vectors)
                
                # Add to index
                self._index.add(vectors)
                
                # Update tenant-specific index
                if tenant_id not in self._tenant_indices:
                    self._tenant_indices[tenant_id] = set()
                self._tenant_indices[tenant_id].update([emb.id for emb in batch])

            # Update metrics
            INDEX_SIZE.set(self._index.ntotal)
            
            logger.info(f"Successfully indexed {len(embeddings)} embeddings for tenant {tenant_id}")

        except Exception as e:
            logger.error(f"Batch indexing error: {str(e)}", 
                        extra={'tenant_id': tenant_id, 'batch_size': len(embeddings)})
            raise

def cosine_similarity(vector_a: np.ndarray, vector_b: np.ndarray) -> float:
    """
    Calculate cosine similarity with optimized numpy operations.

    Args:
        vector_a: First vector
        vector_b: Second vector

    Returns:
        Similarity score between 0 and 1
    """
    if vector_a.shape != vector_b.shape:
        raise ValueError("Vector dimensions must match")

    # Normalize vectors
    norm_a = np.linalg.norm(vector_a)
    norm_b = np.linalg.norm(vector_b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0

    # Calculate similarity
    similarity = np.dot(vector_a, vector_b) / (norm_a * norm_b)
    
    # Handle numerical stability
    return float(np.clip(similarity, -1.0, 1.0))