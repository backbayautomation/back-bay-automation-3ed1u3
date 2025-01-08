"""
Comprehensive test suite for the AI service module implementing GPT-4 based natural language 
processing and response generation functionality.

Version: 1.0.0
"""

import pytest  # version: ^7.4.0
import pytest_asyncio  # version: ^0.21.0
import numpy as np
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch
import json
import time
from typing import Dict, List

from app.services.ai_service import AIService
from app.services.vector_search import VectorSearchService
from app.services.cache_service import CacheService
from app.core.config import settings

# Test data constants
TEST_TENANT_ID = "test-tenant-123"
TEST_QUERY = "What are the specifications of pump model A123?"
TEST_EMBEDDING_DIMENSION = 1536
TEST_CHAT_HISTORY = "Previous chat context"

@pytest.fixture
async def mock_vector_search():
    """Fixture providing mocked vector search service with security validation."""
    mock = AsyncMock(spec=VectorSearchService)
    mock.search.return_value = [
        {
            'chunk_id': 'chunk-1',
            'document_id': 'doc-1',
            'content': 'Pump A123 specifications: Flow rate 500 GPM, Pressure 150 PSI',
            'similarity_score': 0.95,
            'metadata': {'section': 'specifications'}
        }
    ]
    return mock

@pytest.fixture
async def mock_cache_service():
    """Fixture providing mocked cache service with tenant isolation."""
    mock = AsyncMock(spec=CacheService)
    mock.get.return_value = None
    mock.set.return_value = True
    return mock

@pytest.fixture
async def mock_openai():
    """Fixture providing mocked OpenAI client with rate limiting."""
    mock = AsyncMock()
    mock.Embedding.acreate.return_value = {
        'data': [{
            'embedding': np.random.rand(TEST_EMBEDDING_DIMENSION).tolist()
        }]
    }
    mock.ChatCompletion.acreate.return_value = Mock(
        choices=[Mock(message=Mock(content="Test response"))]
    )
    return mock

class TestAIService:
    """Test class for AIService functionality including security and performance."""

    @pytest.fixture(autouse=True)
    async def setup_method(self, mock_vector_search, mock_cache_service, mock_openai):
        """Set up test environment with security context and monitoring."""
        self._vector_search = mock_vector_search
        self._cache = mock_cache_service
        
        # Initialize service with test configuration
        self._ai_service = AIService(
            vector_search_service=self._vector_search,
            cache_service=self._cache,
            tenant_id=TEST_TENANT_ID
        )
        
        # Patch OpenAI client
        with patch('app.services.ai_service.openai', mock_openai):
            yield

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_generate_embeddings(self):
        """Test embedding generation with security validation and monitoring."""
        # Test input
        test_text = "Sample text for embedding generation"
        test_metadata = {'request_type': 'test', 'user_id': 'test-user'}

        # Generate embeddings
        embedding = await self._ai_service.generate_embeddings(test_text, test_metadata)

        # Verify embedding shape and type
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (TEST_EMBEDDING_DIMENSION,)
        
        # Verify OpenAI API called correctly
        self._ai_service._openai.Embedding.acreate.assert_called_once_with(
            input=test_text,
            model="text-embedding-ada-002",
            headers={
                'X-Tenant-ID': TEST_TENANT_ID,
                'X-Request-ID': test_metadata.get('request_id')
            }
        )

        # Verify metrics updated
        assert self._ai_service._metrics['requests'] == 1
        assert self._ai_service._metrics['errors'] == 0

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_process_query(self):
        """Test query processing with context retrieval and response generation."""
        # Test input
        user_context = {'user_id': 'test-user'}

        # Process query
        result = await self._ai_service.process_query(
            TEST_QUERY,
            TEST_CHAT_HISTORY,
            user_context
        )

        # Verify result structure
        assert isinstance(result, dict)
        assert 'response' in result
        assert 'context' in result
        assert 'metrics' in result

        # Verify vector search called correctly
        self._vector_search.search.assert_called_once()
        search_args = self._vector_search.search.call_args[0]
        assert isinstance(search_args[0], np.ndarray)
        assert search_args[1] == TEST_TENANT_ID

        # Verify cache interaction
        cache_key = f"query:{TEST_TENANT_ID}:{hash(TEST_QUERY)}"
        self._cache.get.assert_called_once_with(cache_key)
        self._cache.set.assert_called_once()

        # Verify metrics
        metrics = result['metrics']
        assert 'processing_time' in metrics
        assert 'context_chunks' in metrics
        assert 'token_count' in metrics

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_generate_response(self):
        """Test response generation with security headers and monitoring."""
        # Test input
        test_prompt = "Test prompt"
        test_context = [{'content': 'Test context'}]
        security_context = {'user_id': 'test-user'}

        # Generate response
        response = await self._ai_service.generate_response(
            test_prompt,
            test_context,
            security_context
        )

        # Verify response
        assert isinstance(response, str)
        assert len(response) > 0

        # Verify OpenAI API called correctly
        self._ai_service._openai.ChatCompletion.acreate.assert_called_once()
        completion_args = self._ai_service._openai.ChatCompletion.acreate.call_args[1]
        assert completion_args['model'] == "gpt-4"
        assert len(completion_args['messages']) == 2
        assert completion_args['temperature'] == 0.7

        # Verify security headers
        headers = completion_args['headers']
        assert headers['X-Tenant-ID'] == TEST_TENANT_ID
        assert headers['X-User-ID'] == security_context['user_id']
        assert 'X-Request-ID' in headers

    @pytest.mark.asyncio
    @pytest.mark.security
    async def test_tenant_isolation(self):
        """Test multi-tenant data isolation and security measures."""
        # Test with different tenant IDs
        tenant_1 = "tenant-1"
        tenant_2 = "tenant-2"

        # Create services for different tenants
        service_1 = AIService(self._vector_search, self._cache, tenant_1)
        service_2 = AIService(self._vector_search, self._cache, tenant_2)

        # Generate embeddings for both tenants
        text = "Test text"
        metadata = {'user_id': 'test-user'}

        embedding_1 = await service_1.generate_embeddings(text, metadata)
        embedding_2 = await service_2.generate_embeddings(text, metadata)

        # Verify tenant headers in API calls
        api_calls = self._ai_service._openai.Embedding.acreate.call_args_list
        assert len(api_calls) == 2
        assert api_calls[0][1]['headers']['X-Tenant-ID'] == tenant_1
        assert api_calls[1][1]['headers']['X-Tenant-ID'] == tenant_2

        # Verify vector search tenant isolation
        search_calls = self._vector_search.search.call_args_list
        for call in search_calls:
            assert call[0][1] in [tenant_1, tenant_2]

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_error_handling(self):
        """Test error handling and retry mechanisms."""
        # Configure mock to raise exception
        self._ai_service._openai.Embedding.acreate.side_effect = Exception("API Error")

        # Attempt to generate embeddings
        with pytest.raises(Exception):
            await self._ai_service.generate_embeddings(
                "Test text",
                {'user_id': 'test-user'}
            )

        # Verify error metrics
        assert self._ai_service._metrics['errors'] == 1
        assert self._ai_service._metrics['last_error'] is not None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_health_check(self):
        """Test health check functionality and metrics."""
        # Configure mock responses
        self._vector_search.health_check.return_value = {'status': 'healthy'}
        self._cache.get_stats.return_value = {'hit_ratio': 0.95}

        # Perform health check
        health_status = await self._ai_service.health_check()

        # Verify health check response
        assert isinstance(health_status, dict)
        assert health_status['status'] == 'healthy'
        assert 'openai_api' in health_status
        assert 'vector_search' in health_status
        assert 'cache' in health_status
        assert 'metrics' in health_status
        assert 'timestamp' in health_status

        # Verify service calls
        self._vector_search.health_check.assert_called_once()
        self._cache.get_stats.assert_called_once()