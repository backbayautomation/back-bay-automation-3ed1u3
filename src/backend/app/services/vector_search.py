"""
Vector similarity search service for the AI-powered Product Catalog Search System.
Implements efficient semantic search using high-dimensional vector embeddings with
tenant isolation, monitoring, and enhanced error handling.

Version: 1.0.0
"""

import logging
import numpy as np  # version: 1.24.0
from typing import List, Dict, Optional
from sqlalchemy.orm import Session  # version: 1.4.0
import faiss  # version: 1.7.4
import redis  # version: 4.5.0
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.2.0
from prometheus_client import Counter, Histogram, Gauge  # version: 0.16.0

from app.models.embedding import Embedding
from app.models.chunk import Chunk
from app.db.session import SessionLocal
from app.constants import VectorSearchConfig

# Initialize logging
logger = logging.getLogger(__name__)

# Prometheus metrics
SEARCH_LATENCY = Histogram('vector_search_latency_seconds', 'Vector search latency in seconds')
SEARCH_REQUESTS = Counter('vector_search_requests_total', 'Total vector search requests', ['tenant_id'])
CACHE_HITS = Counter('vector_search_cache_hits_total', 'Cache hit count', ['tenant_id'])
INDEX_SIZE = Gauge('vector_search_index_size', 'Number of vectors in index', ['tenant_id'])
SEARCH_ERRORS = Counter('vector_search_errors_total', 'Search error count', ['error_type'])

class VectorSearchService:
    """Service class implementing vector similarity search with tenant isolation and monitoring."""

    def __init__(self, db_session: Session, cache_client: redis.Redis, config: Dict):
        """Initialize vector search service with configuration and connection pools."""
        self.VECTOR_DIMENSION = VectorSearchConfig.VECTOR_DIMENSION.value
        self.TOP_K = VectorSearchConfig.TOP_K_RESULTS.value
        self.SIMILARITY_THRESHOLD = VectorSearchConfig.SIMILARITY_THRESHOLD.value
        self.BATCH_SIZE = VectorSearchConfig.BATCH_SIZE.value
        
        self._db = db_session
        self._cache = cache_client
        self._tenant_indices: Dict[str, faiss.IndexFlatIP] = {}
        
        # Initialize FAISS index with GPU if available
        try:
            self._resources = faiss.StandardGpuResources()
            self._index_template = faiss.IndexFlatIP(self.VECTOR_DIMENSION)
            self._index_template = faiss.index_cpu_to_gpu(
                self._resources, 0, self._index_template
            )
            logger.info("GPU-enabled FAISS index initialized")
        except Exception as e:
            logger.warning(f"GPU initialization failed, falling back to CPU: {str(e)}")
            self._index_template = faiss.IndexFlatIP(self.VECTOR_DIMENSION)

    def _get_tenant_index(self, tenant_id: str) -> faiss.IndexFlatIP:
        """Get or create tenant-specific FAISS index."""
        if tenant_id not in self._tenant_indices:
            self._tenant_indices[tenant_id] = faiss.clone_index(self._index_template)
            logger.info(f"Created new index for tenant {tenant_id}")
        return self._tenant_indices[tenant_id]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    async def search(
        self,
        query_embedding: np.ndarray,
        tenant_id: str,
        top_k: Optional[int] = None,
        threshold: Optional[float] = None
    ) -> List[Dict]:
        """
        Perform vector similarity search with tenant isolation and caching.
        
        Args:
            query_embedding: Query vector
            tenant_id: Tenant identifier for isolation
            top_k: Optional override for number of results
            threshold: Optional override for similarity threshold
            
        Returns:
            List of similar chunks with scores and metadata
        """
        SEARCH_REQUESTS.labels(tenant_id=tenant_id).inc()
        
        try:
            with SEARCH_LATENCY.time():
                # Validate input
                if query_embedding.shape[0] != self.VECTOR_DIMENSION:
                    raise ValueError(f"Query embedding must have dimension {self.VECTOR_DIMENSION}")
                
                # Normalize query vector
                faiss.normalize_L2(query_embedding.reshape(1, -1))
                
                # Check cache
                cache_key = f"search:{tenant_id}:{hash(query_embedding.tobytes())}"
                cached_result = self._cache.get(cache_key)
                if cached_result:
                    CACHE_HITS.labels(tenant_id=tenant_id).inc()
                    return cached_result
                
                # Get tenant index
                index = self._get_tenant_index(tenant_id)
                
                # Perform search
                k = top_k or self.TOP_K
                sim_threshold = threshold or self.SIMILARITY_THRESHOLD
                
                distances, indices = index.search(
                    query_embedding.reshape(1, -1),
                    k
                )
                
                # Filter results by threshold
                valid_indices = distances[0] >= sim_threshold
                filtered_indices = indices[0][valid_indices]
                filtered_distances = distances[0][valid_indices]
                
                # Fetch chunk data
                results = []
                for idx, score in zip(filtered_indices, filtered_distances):
                    chunk = self._db.query(Chunk).join(Embedding).filter(
                        Embedding.id == idx
                    ).first()
                    
                    if chunk:
                        results.append({
                            'chunk_id': str(chunk.id),
                            'content': chunk.content,
                            'similarity_score': float(score),
                            'metadata': chunk.metadata
                        })
                
                # Cache results
                self._cache.setex(
                    cache_key,
                    3600,  # 1 hour TTL
                    results
                )
                
                return results
                
        except Exception as e:
            error_type = type(e).__name__
            SEARCH_ERRORS.labels(error_type=error_type).inc()
            logger.error(f"Search error for tenant {tenant_id}: {str(e)}", exc_info=True)
            raise

    async def batch_index(
        self,
        embeddings: List[Embedding],
        tenant_id: str
    ) -> None:
        """
        Index batch of embeddings with optimized processing.
        
        Args:
            embeddings: List of embedding objects to index
            tenant_id: Tenant identifier for isolation
        """
        try:
            # Get tenant index
            index = self._get_tenant_index(tenant_id)
            
            # Process in batches
            for i in range(0, len(embeddings), self.BATCH_SIZE):
                batch = embeddings[i:i + self.BATCH_SIZE]
                
                # Convert to numpy array
                vectors = np.vstack([emb.get_vector() for emb in batch])
                
                # Normalize vectors
                faiss.normalize_L2(vectors)
                
                # Add to index
                index.add(vectors)
            
            # Update metrics
            INDEX_SIZE.labels(tenant_id=tenant_id).set(index.ntotal)
            logger.info(f"Indexed {len(embeddings)} vectors for tenant {tenant_id}")
            
        except Exception as e:
            error_type = type(e).__name__
            SEARCH_ERRORS.labels(error_type=error_type).inc()
            logger.error(f"Indexing error for tenant {tenant_id}: {str(e)}", exc_info=True)
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
    try:
        # Validate dimensions
        if vector_a.shape != vector_b.shape:
            raise ValueError("Vectors must have same dimensions")
            
        # Normalize vectors
        norm_a = np.linalg.norm(vector_a)
        norm_b = np.linalg.norm(vector_b)
        
        # Handle zero vectors
        if norm_a == 0 or norm_b == 0:
            return 0.0
            
        # Calculate similarity
        similarity = np.dot(vector_a, vector_b) / (norm_a * norm_b)
        
        # Bound result to [0, 1]
        return float(np.clip(similarity, 0, 1))
        
    except Exception as e:
        logger.error(f"Similarity calculation error: {str(e)}", exc_info=True)
        raise