"""
Vector similarity search service implementation for the AI-powered Product Catalog Search System.
Provides efficient semantic search capabilities with tenant isolation, monitoring, and caching.

Version: 1.0.0
"""

import logging
import numpy as np  # version: ^1.24.0
import faiss  # version: ^1.7.4
import redis  # version: ^4.5.0
from tenacity import retry, stop_after_attempt  # version: ^8.2.0
from typing import List, Dict, Optional
from prometheus_client import Counter, Histogram, Gauge  # version: ^0.16.0
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.models.embedding import Embedding
from app.models.chunk import Chunk
from app.db.session import SessionLocal
from app.core.config import settings

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize Prometheus metrics
VECTOR_SEARCH_DURATION = Histogram(
    'vector_search_duration_seconds',
    'Time spent performing vector similarity search'
)
VECTOR_SEARCH_REQUESTS = Counter(
    'vector_search_requests_total',
    'Total number of vector search requests',
    ['tenant_id', 'status']
)
CACHE_HITS = Counter(
    'vector_search_cache_hits_total',
    'Total number of cache hits',
    ['tenant_id']
)
ACTIVE_INDICES = Gauge(
    'vector_search_active_indices',
    'Number of active tenant indices'
)

class VectorSearchService:
    """Service class implementing vector similarity search with tenant isolation and monitoring."""

    def __init__(self, db_session: Session, cache_client: redis.Redis, config: Dict):
        """Initialize vector search service with configuration and connection pools."""
        self.VECTOR_DIMENSION = settings.VECTOR_SEARCH_CONFIG['dimension']
        self.TOP_K = settings.VECTOR_SEARCH_CONFIG['top_k_results']
        self.SIMILARITY_THRESHOLD = settings.VECTOR_SEARCH_CONFIG['similarity_threshold']
        self.BATCH_SIZE = settings.VECTOR_SEARCH_CONFIG['batch_size']
        
        self._db = db_session
        self._cache = cache_client
        self._tenant_indices: Dict[str, faiss.IndexFlatIP] = {}
        
        # Initialize FAISS index with GPU support if available
        try:
            self._init_gpu_resources()
        except Exception as e:
            logger.warning(f"GPU initialization failed, falling back to CPU: {str(e)}")
            self._init_cpu_resources()
            
        ACTIVE_INDICES.set(0)
        logger.info("Vector search service initialized successfully")

    def _init_gpu_resources(self):
        """Initialize GPU resources for FAISS if available."""
        import faiss.contrib.torch_utils
        self.res = faiss.StandardGpuResources()
        self._index_template = faiss.GpuIndexFlatIP(self.res, self.VECTOR_DIMENSION)
        logger.info("GPU resources initialized for vector search")

    def _init_cpu_resources(self):
        """Initialize CPU-only resources for FAISS."""
        self._index_template = faiss.IndexFlatIP(self.VECTOR_DIMENSION)
        logger.info("CPU resources initialized for vector search")

    def _get_tenant_index(self, tenant_id: str) -> faiss.IndexFlatIP:
        """Get or create tenant-specific FAISS index."""
        if tenant_id not in self._tenant_indices:
            self._tenant_indices[tenant_id] = faiss.clone_index(self._index_template)
            ACTIVE_INDICES.inc()
            logger.info(f"Created new index for tenant {tenant_id}")
        return self._tenant_indices[tenant_id]

    @retry(stop=stop_after_attempt(3))
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
        VECTOR_SEARCH_REQUESTS.labels(tenant_id=tenant_id, status='started').inc()
        
        try:
            # Validate and normalize query embedding
            if query_embedding.shape[0] != self.VECTOR_DIMENSION:
                raise ValueError(f"Query embedding must have dimension {self.VECTOR_DIMENSION}")
            query_embedding = query_embedding.astype(np.float32)
            query_embedding /= np.linalg.norm(query_embedding)
            
            # Check cache
            cache_key = f"vector_search:{tenant_id}:{hash(query_embedding.tobytes())}"
            cached_result = self._cache.get(cache_key)
            if cached_result:
                CACHE_HITS.labels(tenant_id=tenant_id).inc()
                return cached_result
            
            with VECTOR_SEARCH_DURATION.time():
                # Get tenant-specific index
                index = self._get_tenant_index(tenant_id)
                
                # Perform similarity search
                k = top_k or self.TOP_K
                sim_threshold = threshold or self.SIMILARITY_THRESHOLD
                scores, indices = index.search(query_embedding.reshape(1, -1), k)
                
                # Filter results by threshold
                valid_mask = scores[0] >= sim_threshold
                filtered_scores = scores[0][valid_mask]
                filtered_indices = indices[0][valid_mask]
                
                # Fetch chunk content and metadata
                results = []
                for score, idx in zip(filtered_scores, filtered_indices):
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
                    settings.get_vector_search_settings().get('cache_ttl', 3600),
                    results
                )
                
                VECTOR_SEARCH_REQUESTS.labels(tenant_id=tenant_id, status='success').inc()
                return results
                
        except Exception as e:
            VECTOR_SEARCH_REQUESTS.labels(tenant_id=tenant_id, status='error').inc()
            logger.error(f"Vector search error for tenant {tenant_id}: {str(e)}", exc_info=True)
            raise

    async def batch_index(self, embeddings: List[Embedding], tenant_id: str) -> None:
        """
        Index batch of embeddings with optimized processing.
        
        Args:
            embeddings: List of embedding objects to index
            tenant_id: Tenant identifier for isolation
        """
        try:
            # Process embeddings in batches
            for i in range(0, len(embeddings), self.BATCH_SIZE):
                batch = embeddings[i:i + self.BATCH_SIZE]
                vectors = np.vstack([emb.get_vector() for emb in batch])
                
                # Normalize vectors
                vectors = vectors.astype(np.float32)
                faiss.normalize_L2(vectors)
                
                # Add to tenant-specific index
                index = self._get_tenant_index(tenant_id)
                index.add(vectors)
                
            logger.info(f"Successfully indexed {len(embeddings)} embeddings for tenant {tenant_id}")
            
        except Exception as e:
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
    if vector_a.shape != vector_b.shape:
        raise ValueError("Vectors must have same dimensions")
        
    # Normalize vectors
    vector_a = vector_a.astype(np.float32)
    vector_b = vector_b.astype(np.float32)
    vector_a /= np.linalg.norm(vector_a)
    vector_b /= np.linalg.norm(vector_b)
    
    # Calculate similarity
    similarity = np.dot(vector_a, vector_b)
    
    # Handle numerical stability
    similarity = min(max(similarity, 0.0), 1.0)
    
    return float(similarity)