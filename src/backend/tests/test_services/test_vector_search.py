"""
Comprehensive test suite for the vector search service implementation.
Tests vector similarity search functionality, tenant isolation, caching,
error handling, and performance monitoring.

Version: 1.0.0
"""

import pytest
import numpy as np  # version: ^1.24.0
import fakeredis  # version: ^2.10.0
from uuid import uuid4
from pytest_mock import MockerFixture  # version: ^3.10.0
from prometheus_client import Counter, Histogram  # version: ^0.16.0
from tenacity import RetryError  # version: ^8.2.0

from app.services.vector_search import VectorSearchService, cosine_similarity
from app.models.embedding import Embedding
from app.core.config import settings

# Test constants based on technical specifications
VECTOR_DIMENSION = 1536  # From A.1.1 Vector Processing
SIMILARITY_THRESHOLD = 0.8  # From A.1.1 Search Parameters
BATCH_SIZE = 32  # From A.1.1 Vector Processing
TEST_EMBEDDING_COUNT = 10
MAX_RETRIES = 3
RETRY_DELAY = 1.0
METRICS_PREFIX = 'vector_search_test'

@pytest.fixture
def mock_redis():
    """Fixture providing a mock Redis instance for testing cache operations."""
    return fakeredis.FakeStrictRedis()

@pytest.fixture
def db_session(mocker):
    """Fixture providing a mock database session."""
    mock_session = mocker.MagicMock()
    mock_session.commit = mocker.MagicMock()
    mock_session.rollback = mocker.MagicMock()
    return mock_session

@pytest.fixture
def vector_search_service(db_session, mock_redis):
    """Fixture providing configured vector search service instance."""
    config = {
        'dimension': VECTOR_DIMENSION,
        'similarity_threshold': SIMILARITY_THRESHOLD,
        'batch_size': BATCH_SIZE
    }
    return VectorSearchService(db_session, mock_redis, config)

@pytest.fixture
def create_test_embeddings(db_session):
    """Create test embedding vectors with tenant isolation."""
    def _create_embeddings(count: int, tenant_id: str):
        embeddings = []
        for i in range(count):
            # Generate random normalized vector
            vector = np.random.randn(VECTOR_DIMENSION).astype(np.float32)
            vector /= np.linalg.norm(vector)
            
            # Create embedding with tenant association
            embedding = Embedding(
                chunk_id=uuid4(),
                embedding_vector=vector,
                similarity_score=0.0,
                metadata={
                    'tenant_id': tenant_id,
                    'vector_params': {
                        'dimension': VECTOR_DIMENSION,
                        'algorithm': 'cosine'
                    }
                }
            )
            embeddings.append(embedding)
            
        db_session.add_all(embeddings)
        db_session.commit()
        return embeddings
    
    return _create_embeddings

@pytest.mark.asyncio
async def test_vector_search_basic(vector_search_service, create_test_embeddings):
    """Test basic vector similarity search functionality."""
    tenant_id = str(uuid4())
    test_embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_id)
    
    # Create query vector
    query_vector = np.random.randn(VECTOR_DIMENSION).astype(np.float32)
    query_vector /= np.linalg.norm(query_vector)
    
    # Perform search
    results = await vector_search_service.search(
        query_embedding=query_vector,
        tenant_id=tenant_id,
        threshold=SIMILARITY_THRESHOLD
    )
    
    assert len(results) > 0
    assert all(0.0 <= result['similarity_score'] <= 1.0 for result in results)
    assert all(result['similarity_score'] >= SIMILARITY_THRESHOLD for result in results)

@pytest.mark.asyncio
async def test_multi_tenant_isolation(vector_search_service, create_test_embeddings):
    """Test vector search isolation between tenants."""
    tenant_a_id = str(uuid4())
    tenant_b_id = str(uuid4())
    
    # Create embeddings for both tenants
    tenant_a_embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_a_id)
    tenant_b_embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_b_id)
    
    # Index embeddings for both tenants
    await vector_search_service.batch_index(tenant_a_embeddings, tenant_a_id)
    await vector_search_service.batch_index(tenant_b_embeddings, tenant_b_id)
    
    # Create query vector
    query_vector = np.random.randn(VECTOR_DIMENSION).astype(np.float32)
    query_vector /= np.linalg.norm(query_vector)
    
    # Search with tenant A context
    results_a = await vector_search_service.search(query_vector, tenant_a_id)
    
    # Search with tenant B context
    results_b = await vector_search_service.search(query_vector, tenant_b_id)
    
    # Verify tenant isolation
    assert all(r['metadata']['tenant_id'] == tenant_a_id for r in results_a)
    assert all(r['metadata']['tenant_id'] == tenant_b_id for r in results_b)

@pytest.mark.asyncio
async def test_cache_operations(vector_search_service, mock_redis, create_test_embeddings):
    """Test vector search cache operations and hit rates."""
    tenant_id = str(uuid4())
    test_embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_id)
    
    # Index test embeddings
    await vector_search_service.batch_index(test_embeddings, tenant_id)
    
    # Create query vector
    query_vector = np.random.randn(VECTOR_DIMENSION).astype(np.float32)
    query_vector /= np.linalg.norm(query_vector)
    
    # First search should be cache miss
    results_first = await vector_search_service.search(query_vector, tenant_id)
    
    # Second search should be cache hit
    results_second = await vector_search_service.search(query_vector, tenant_id)
    
    assert results_first == results_second
    assert mock_redis.get.call_count == 2
    assert mock_redis.set.call_count == 1

@pytest.mark.asyncio
async def test_error_handling(vector_search_service, mocker):
    """Test error handling and retry mechanisms."""
    tenant_id = str(uuid4())
    
    # Mock database error
    mocker.patch.object(
        vector_search_service._db,
        'query',
        side_effect=Exception("Database error")
    )
    
    # Create query vector
    query_vector = np.random.randn(VECTOR_DIMENSION).astype(np.float32)
    query_vector /= np.linalg.norm(query_vector)
    
    # Verify retry behavior
    with pytest.raises(RetryError):
        await vector_search_service.search(query_vector, tenant_id)

@pytest.mark.asyncio
async def test_performance_monitoring(vector_search_service, create_test_embeddings):
    """Test performance metrics collection and monitoring."""
    tenant_id = str(uuid4())
    test_embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT, tenant_id)
    
    # Reset metrics before test
    vector_search_service.VECTOR_SEARCH_DURATION._metrics.clear()
    vector_search_service.VECTOR_SEARCH_REQUESTS._metrics.clear()
    
    # Index embeddings and perform search
    await vector_search_service.batch_index(test_embeddings, tenant_id)
    query_vector = np.random.randn(VECTOR_DIMENSION).astype(np.float32)
    query_vector /= np.linalg.norm(query_vector)
    
    await vector_search_service.search(query_vector, tenant_id)
    
    # Verify metrics were recorded
    assert vector_search_service.VECTOR_SEARCH_DURATION._metrics
    assert vector_search_service.VECTOR_SEARCH_REQUESTS._metrics

@pytest.mark.asyncio
async def test_batch_indexing(vector_search_service, create_test_embeddings):
    """Test batch indexing functionality and optimizations."""
    tenant_id = str(uuid4())
    test_embeddings = create_test_embeddings(TEST_EMBEDDING_COUNT * 2, tenant_id)
    
    # Perform batch indexing
    await vector_search_service.batch_index(test_embeddings, tenant_id)
    
    # Verify index size
    tenant_index = vector_search_service._get_tenant_index(tenant_id)
    assert tenant_index.ntotal == len(test_embeddings)

def test_cosine_similarity():
    """Test cosine similarity calculation function."""
    # Create test vectors
    vector_a = np.random.randn(VECTOR_DIMENSION).astype(np.float32)
    vector_a /= np.linalg.norm(vector_a)
    
    vector_b = np.random.randn(VECTOR_DIMENSION).astype(np.float32)
    vector_b /= np.linalg.norm(vector_b)
    
    # Calculate similarity
    similarity = cosine_similarity(vector_a, vector_b)
    
    assert 0.0 <= similarity <= 1.0
    
    # Test similarity with same vector
    self_similarity = cosine_similarity(vector_a, vector_a)
    assert np.isclose(self_similarity, 1.0)