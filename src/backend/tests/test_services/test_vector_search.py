"""
Comprehensive test suite for the vector search service implementation.
Tests vector search functionality, tenant isolation, error handling, and performance monitoring.

Version: 1.0.0
"""

import pytest
import numpy as np
import uuid
from datetime import datetime
from unittest.mock import Mock, patch
from prometheus_client import Counter, Histogram, Gauge
from tenacity import RetryError

from app.services.vector_search import VectorSearchService
from app.models.embedding import Embedding
from app.models.chunk import Chunk
from app.models.document import Document
from app.constants import VectorSearchConfig

# Test configuration constants
VECTOR_DIMENSION = VectorSearchConfig.VECTOR_DIMENSION.value
TEST_EMBEDDING_COUNT = 10
SIMILARITY_THRESHOLD = VectorSearchConfig.SIMILARITY_THRESHOLD.value
MAX_RETRIES = 3
RETRY_DELAY = 1.0
CIRCUIT_BREAKER_THRESHOLD = 5
METRICS_PREFIX = 'vector_search_test'

@pytest.fixture
def mock_cache():
    """Create mock Redis cache for testing."""
    return Mock()

@pytest.fixture
def mock_metrics():
    """Create mock Prometheus metrics for testing."""
    return {
        'search_requests': Counter('test_search_requests', 'Test search requests'),
        'search_latency': Histogram('test_search_latency', 'Test search latency'),
        'cache_hits': Counter('test_cache_hits', 'Test cache hits'),
        'cache_misses': Counter('test_cache_misses', 'Test cache misses'),
        'index_size': Gauge('test_index_size', 'Test index size')
    }

@pytest.fixture
async def test_embeddings(db_session):
    """Create test embeddings with associated chunks and documents."""
    embeddings = []
    client_id = uuid.uuid4()
    document = Document(
        client_id=client_id,
        filename="test_doc.pdf",
        type="pdf",
        metadata={"test": True}
    )
    db_session.add(document)
    
    for i in range(TEST_EMBEDDING_COUNT):
        # Create random vector with correct dimension
        vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
        vector = vector / np.linalg.norm(vector)  # Normalize vector
        
        # Create chunk
        chunk = Chunk(
            document_id=document.id,
            content=f"Test content {i}",
            sequence=i,
            metadata={"test": True}
        )
        db_session.add(chunk)
        
        # Create embedding
        embedding = Embedding(
            chunk_id=chunk.id,
            embedding_vector=vector,
            similarity_score=0.0,
            metadata={
                "test": True,
                "vector_params": {
                    "dimension": VECTOR_DIMENSION,
                    "algorithm": "cosine",
                    "batch_size": 32
                }
            }
        )
        embeddings.append(embedding)
        db_session.add(embedding)
    
    await db_session.commit()
    return embeddings

@pytest.mark.asyncio
async def test_vector_search_basic(db_session, mock_cache, test_embeddings):
    """Test basic vector similarity search functionality."""
    # Initialize service
    service = VectorSearchService(db_session, mock_cache)
    
    # Create query vector
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    # Perform search
    results = await service.search(
        query_embedding=query_vector,
        tenant_id=str(test_embeddings[0].chunk.document.client_id),
        threshold=SIMILARITY_THRESHOLD
    )
    
    # Validate results
    assert isinstance(results, list)
    assert len(results) > 0
    for result in results:
        assert 'chunk_id' in result
        assert 'similarity_score' in result
        assert 0 <= result['similarity_score'] <= 1
        assert result['similarity_score'] >= SIMILARITY_THRESHOLD

@pytest.mark.asyncio
async def test_multi_tenant_isolation(db_session, mock_cache):
    """Test vector search isolation between tenants."""
    # Create embeddings for two tenants
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()
    
    # Create documents for each tenant
    doc_a = Document(client_id=tenant_a_id, filename="doc_a.pdf", type="pdf")
    doc_b = Document(client_id=tenant_b_id, filename="doc_b.pdf", type="pdf")
    db_session.add_all([doc_a, doc_b])
    await db_session.commit()
    
    # Create embeddings for each tenant
    embeddings_a = []
    embeddings_b = []
    
    for i in range(5):
        # Tenant A embeddings
        vector_a = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
        vector_a = vector_a / np.linalg.norm(vector_a)
        chunk_a = Chunk(document_id=doc_a.id, content=f"Tenant A content {i}", sequence=i)
        db_session.add(chunk_a)
        embedding_a = Embedding(chunk_id=chunk_a.id, embedding_vector=vector_a)
        embeddings_a.append(embedding_a)
        
        # Tenant B embeddings
        vector_b = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
        vector_b = vector_b / np.linalg.norm(vector_b)
        chunk_b = Chunk(document_id=doc_b.id, content=f"Tenant B content {i}", sequence=i)
        db_session.add(chunk_b)
        embedding_b = Embedding(chunk_id=chunk_b.id, embedding_vector=vector_b)
        embeddings_b.append(embedding_b)
    
    db_session.add_all(embeddings_a + embeddings_b)
    await db_session.commit()
    
    # Initialize service
    service = VectorSearchService(db_session, mock_cache)
    
    # Test search with tenant A context
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    results_a = await service.search(query_vector, str(tenant_a_id))
    
    # Verify only tenant A results
    assert all(result['document_id'] == str(doc_a.id) for result in results_a)
    
    # Test search with tenant B context
    results_b = await service.search(query_vector, str(tenant_b_id))
    
    # Verify only tenant B results
    assert all(result['document_id'] == str(doc_b.id) for result in results_b)

@pytest.mark.asyncio
async def test_error_handling(db_session, mock_cache, test_embeddings):
    """Test error handling and retry mechanisms."""
    # Configure mock cache to simulate errors
    mock_cache.get.side_effect = [Exception("Cache error"), None]
    
    service = VectorSearchService(db_session, mock_cache)
    
    # Test retry mechanism
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    with pytest.raises(RetryError):
        await service.search(
            query_vector,
            str(test_embeddings[0].chunk.document.client_id),
            max_retries=2
        )
    
    # Verify cache error handling
    assert mock_cache.get.call_count == 2  # Retried once
    
    # Test invalid vector dimension
    invalid_vector = np.random.rand(VECTOR_DIMENSION + 1).astype(np.float32)
    with pytest.raises(ValueError):
        await service.search(
            invalid_vector,
            str(test_embeddings[0].chunk.document.client_id)
        )

@pytest.mark.asyncio
async def test_performance_monitoring(db_session, mock_cache, mock_metrics, test_embeddings):
    """Test performance metrics collection and monitoring."""
    service = VectorSearchService(
        db_session,
        mock_cache,
        metrics=mock_metrics
    )
    
    # Perform multiple searches to generate metrics
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    for _ in range(5):
        await service.search(
            query_vector,
            str(test_embeddings[0].chunk.document.client_id)
        )
    
    # Verify metrics collection
    assert mock_metrics['search_requests']._value._value == 5
    assert mock_metrics['search_latency']._sum._value > 0
    assert mock_metrics['cache_misses']._value._value > 0
    assert mock_metrics['index_size']._value._value == len(test_embeddings)

@pytest.mark.asyncio
async def test_batch_indexing(db_session, mock_cache, test_embeddings):
    """Test batch indexing functionality."""
    service = VectorSearchService(db_session, mock_cache)
    
    # Batch index embeddings
    await service.batch_index(
        test_embeddings,
        str(test_embeddings[0].chunk.document.client_id)
    )
    
    # Verify index size
    assert service._index.ntotal == len(test_embeddings)
    
    # Test search after indexing
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    results = await service.search(
        query_vector,
        str(test_embeddings[0].chunk.document.client_id)
    )
    
    assert len(results) > 0
    assert all(0 <= result['similarity_score'] <= 1 for result in results)

@pytest.mark.asyncio
async def test_cache_operations(db_session, mock_cache, test_embeddings):
    """Test caching functionality."""
    service = VectorSearchService(db_session, mock_cache)
    
    query_vector = np.random.rand(VECTOR_DIMENSION).astype(np.float32)
    query_vector = query_vector / np.linalg.norm(query_vector)
    
    # First search - should miss cache
    mock_cache.get.return_value = None
    results1 = await service.search(
        query_vector,
        str(test_embeddings[0].chunk.document.client_id)
    )
    
    # Second search - should hit cache
    mock_cache.get.return_value = results1
    results2 = await service.search(
        query_vector,
        str(test_embeddings[0].chunk.document.client_id)
    )
    
    assert results1 == results2
    assert mock_cache.get.call_count == 2
    assert mock_cache.setex.call_count == 1