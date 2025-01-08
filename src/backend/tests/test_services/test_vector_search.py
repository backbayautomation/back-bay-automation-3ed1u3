"""
Comprehensive test suite for the vector search service implementation.
Tests vector similarity search, embedding indexing, caching, multi-tenant isolation,
error handling, and performance monitoring.

Version: 1.0.0
"""

import pytest
import numpy as np
from uuid import uuid4
from datetime import datetime
import fakeredis
from prometheus_client import Counter, Histogram
from tenacity import RetryError

from app.services.vector_search import VectorSearchService
from app.models.embedding import Embedding
from app.models.chunk import Chunk
from app.constants import VectorSearchConfig

# Test configuration constants
VECTOR_DIMENSION = VectorSearchConfig.VECTOR_DIMENSION.value
TEST_EMBEDDING_COUNT = 10
SIMILARITY_THRESHOLD = 0.8
MAX_RETRIES = 3
RETRY_DELAY = 1.0
CIRCUIT_BREAKER_THRESHOLD = 5
METRICS_PREFIX = 'vector_search_test'

# Initialize test metrics
SEARCH_LATENCY = Histogram(f'{METRICS_PREFIX}_latency_seconds', 'Test search latency')
SEARCH_ERRORS = Counter(f'{METRICS_PREFIX}_errors_total', 'Test error count')

@pytest.fixture
def mock_cache():
    """Fixture providing a mock Redis cache for testing."""
    return fakeredis.FakeStrictRedis()

@pytest.fixture
async def vector_service(db_session, mock_cache):
    """Fixture providing configured vector search service."""
    config = {
        'vector_dimension': VECTOR_DIMENSION,
        'similarity_threshold': SIMILARITY_THRESHOLD,
        'max_retries': MAX_RETRIES,
        'retry_delay': RETRY_DELAY
    }
    return VectorSearchService(db_session, mock_cache, config)

@pytest.fixture
def create_test_embeddings(db_session):
    """
    Create test embedding vectors with tenant isolation.
    
    Args:
        db_session: Database session
        count: Number of embeddings to create
        tenant_id: Tenant identifier
        
    Returns:
        List of created embeddings
    """
    def _create_embeddings(count: int, tenant_id: str):
        embeddings = []
        for i in range(count):
            # Create random vector
            vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
            vector = vector / np.linalg.norm(vector)
            
            # Create chunk with tenant isolation
            chunk = Chunk(
                document_id=uuid4(),
                content=f"Test content {i}",
                sequence=i,
                metadata={
                    'tenant_id': tenant_id,
                    'test_id': i
                }
            )
            db_session.add(chunk)
            
            # Create embedding
            embedding = Embedding(
                chunk_id=chunk.id,
                embedding_vector=vector,
                similarity_score=1.0,
                metadata={
                    'tenant_id': tenant_id,
                    'test_metadata': f'test_{i}'
                }
            )
            db_session.add(embedding)
            embeddings.append(embedding)
        
        db_session.commit()
        return embeddings
    
    return _create_embeddings

@pytest.mark.asyncio
async def test_vector_search_basic(vector_service, create_test_embeddings):
    """Test basic vector similarity search functionality."""
    tenant_id = str(uuid4())
    embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_id)
    
    # Create query vector
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    # Perform search
    results = await vector_service.search(query_vector, tenant_id)
    
    # Validate results
    assert len(results) > 0
    assert all(0 <= result['similarity_score'] <= 1 for result in results)
    assert all('chunk_id' in result for result in results)
    assert all('content' in result for result in results)

@pytest.mark.asyncio
async def test_multi_tenant_isolation(vector_service, create_test_embeddings):
    """Test vector search isolation between tenants."""
    tenant_a = str(uuid4())
    tenant_b = str(uuid4())
    
    # Create embeddings for both tenants
    embeddings_a = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_a)
    embeddings_b = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_b)
    
    # Index embeddings
    await vector_service.batch_index(embeddings_a, tenant_a)
    await vector_service.batch_index(embeddings_b, tenant_b)
    
    # Create query vector
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    # Search with tenant A context
    results_a = await vector_service.search(query_vector, tenant_a)
    
    # Verify only tenant A results
    assert all(result['metadata']['tenant_id'] == tenant_a for result in results_a)
    
    # Search with tenant B context
    results_b = await vector_service.search(query_vector, tenant_b)
    
    # Verify only tenant B results
    assert all(result['metadata']['tenant_id'] == tenant_b for result in results_b)

@pytest.mark.asyncio
async def test_batch_indexing(vector_service, create_test_embeddings):
    """Test batch indexing of embeddings."""
    tenant_id = str(uuid4())
    embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT * 2, tenant_id)
    
    # Perform batch indexing
    await vector_service.batch_index(embeddings, tenant_id)
    
    # Verify index size
    index = vector_service._get_tenant_index(tenant_id)
    assert index.ntotal == len(embeddings)
    
    # Verify search works after indexing
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    results = await vector_service.search(query_vector, tenant_id)
    assert len(results) > 0

@pytest.mark.asyncio
async def test_cache_operations(vector_service, create_test_embeddings, mock_cache):
    """Test vector search caching functionality."""
    tenant_id = str(uuid4())
    embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_id)
    
    # Index embeddings
    await vector_service.batch_index(embeddings, tenant_id)
    
    # Create query vector
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    # First search - should miss cache
    results_1 = await vector_service.search(query_vector, tenant_id)
    
    # Second search - should hit cache
    results_2 = await vector_service.search(query_vector, tenant_id)
    
    # Verify results are identical
    assert results_1 == results_2
    
    # Verify cache hit metrics
    cache_hits = mock_cache.get(f"search:{tenant_id}:{hash(query_vector.tobytes())}")
    assert cache_hits is not None

@pytest.mark.asyncio
async def test_error_handling(vector_service, create_test_embeddings, mock_cache):
    """Test error handling and retry mechanisms."""
    tenant_id = str(uuid4())
    embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_id)
    
    # Simulate cache failure
    mock_cache.flushall()
    
    # Test retry mechanism
    with pytest.raises(RetryError):
        await vector_service.search(
            np.zeros(VECTOR_DIMENSION + 1),  # Invalid dimension
            tenant_id
        )
    
    # Verify error metrics
    assert SEARCH_ERRORS._value.get() > 0

@pytest.mark.asyncio
async def test_performance_monitoring(vector_service, create_test_embeddings):
    """Test performance metrics collection and monitoring."""
    tenant_id = str(uuid4())
    embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_id)
    
    # Index embeddings
    await vector_service.batch_index(embeddings, tenant_id)
    
    # Perform multiple searches
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    for _ in range(5):
        await vector_service.search(query_vector, tenant_id)
    
    # Verify metrics
    assert SEARCH_LATENCY._sum.get() > 0
    
    # Get service metrics
    metrics = await vector_service.get_metrics()
    assert 'search_latency' in metrics
    assert 'index_size' in metrics
    assert metrics['index_size'][tenant_id] == TEST_EMBEDDING_COUNT

@pytest.mark.asyncio
async def test_similarity_threshold(vector_service, create_test_embeddings):
    """Test similarity threshold filtering."""
    tenant_id = str(uuid4())
    embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_id)
    
    # Index embeddings
    await vector_service.batch_index(embeddings, tenant_id)
    
    # Create query vector
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    # Search with different thresholds
    results_default = await vector_service.search(query_vector, tenant_id)
    results_high = await vector_service.search(
        query_vector, 
        tenant_id, 
        threshold=0.9
    )
    results_low = await vector_service.search(
        query_vector, 
        tenant_id, 
        threshold=0.5
    )
    
    # Verify threshold filtering
    assert len(results_high) <= len(results_default) <= len(results_low)
    assert all(r['similarity_score'] >= 0.9 for r in results_high)
    assert all(r['similarity_score'] >= 0.5 for r in results_low)