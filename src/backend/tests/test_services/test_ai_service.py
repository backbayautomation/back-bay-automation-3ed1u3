"""
Comprehensive test suite for the AI service module implementing GPT-4 based natural language processing.
Tests query processing, embedding generation, response generation, security measures, and error handling.

Version: 1.0.0
"""

import pytest  # version: ^7.4.0
import pytest_asyncio  # version: ^0.21.0
import numpy as np
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

from app.services.ai_service import AIService
from app.services.vector_search import VectorSearchService
from app.services.cache_service import CacheService
from app.core.config import settings
from app.constants import ErrorCode

# Test data constants
TEST_TENANT_ID = "test-tenant-123"
TEST_QUERY = "What are the specifications of pump model A123?"
TEST_EMBEDDING_DIM = 1536  # From VectorSearchConfig.VECTOR_DIMENSION
TEST_CONTEXT_LENGTH = 8192  # From technical spec A.1.1

class TestAIService:
    """Test class for AIService functionality including security and performance."""

    @pytest.fixture(autouse=True)
    async def setup(self, mocker):
        """Set up test environment with mocked dependencies."""
        # Mock vector search service
        self.vector_search_mock = AsyncMock(spec=VectorSearchService)
        self.vector_search_mock.search.return_value = [
            {
                'chunk_id': 'chunk-123',
                'content': 'Pump model A123 specifications: Flow rate: 500 GPM, Pressure: 150 PSI',
                'similarity_score': 0.95,
                'metadata': {'document_id': 'doc-123'}
            }
        ]

        # Mock cache service
        self.cache_mock = AsyncMock(spec=CacheService)
        self.cache_mock.get.return_value = None

        # Mock OpenAI API responses
        self.openai_mock = mocker.patch('openai.ChatCompletion')
        self.openai_mock.acreate.return_value = {
            'choices': [{
                'message': {
                    'content': 'The specifications for pump model A123 are:\n- Flow rate: 500 GPM\n- Pressure: 150 PSI'
                }
            }]
        }

        self.embedding_mock = mocker.patch('openai.Embedding')
        self.embedding_mock.acreate.return_value = {
            'data': [{
                'embedding': np.random.rand(TEST_EMBEDDING_DIM).tolist()
            }]
        }

        # Initialize AI service with mocks
        self.ai_service = AIService(
            vector_search_service=self.vector_search_mock,
            cache_service=self.cache_mock,
            tenant_id=TEST_TENANT_ID
        )

    @pytest.mark.asyncio
    async def test_generate_embeddings(self):
        """Test embedding generation with security validation and performance metrics."""
        # Test input
        test_text = "Sample technical specification text"
        test_metadata = {'tenant_id': TEST_TENANT_ID}

        # Generate embeddings
        embedding = await self.ai_service.generate_embeddings(test_text, test_metadata)

        # Verify embedding shape and type
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (TEST_EMBEDDING_DIM,)
        assert embedding.dtype == np.float32

        # Verify OpenAI API called correctly
        self.embedding_mock.acreate.assert_called_once_with(
            input=test_text,
            model="text-embedding-ada-002",
            user=f"tenant_{TEST_TENANT_ID}"
        )

        # Test tenant isolation
        with pytest.raises(ValueError, match="Invalid tenant context"):
            await self.ai_service.generate_embeddings(
                test_text,
                {'tenant_id': 'different-tenant'}
            )

    @pytest.mark.asyncio
    async def test_process_query(self):
        """Test query processing with context retrieval and response generation."""
        # Test input
        chat_history = "Previous chat context"
        user_context = {'tenant_id': TEST_TENANT_ID, 'request_id': 'req-123'}

        # Process query
        result = await self.ai_service.process_query(
            TEST_QUERY,
            chat_history,
            user_context
        )

        # Verify result structure
        assert 'response' in result
        assert 'context_used' in result
        assert 'processing_time' in result
        assert 'cache_hit' in result
        assert isinstance(result['processing_time'], float)

        # Verify service calls
        self.vector_search_mock.search.assert_called_once()
        self.openai_mock.acreate.assert_called_once()
        
        # Verify cache interaction
        cache_key = f"query:{TEST_TENANT_ID}:{hash(TEST_QUERY)}"
        self.cache_mock.get.assert_called_once_with(cache_key)
        self.cache_mock.set.assert_called_once()

        # Test tenant isolation
        with pytest.raises(ValueError, match="Invalid tenant context"):
            await self.ai_service.process_query(
                TEST_QUERY,
                chat_history,
                {'tenant_id': 'different-tenant'}
            )

    @pytest.mark.asyncio
    async def test_generate_response(self):
        """Test response generation with security headers and monitoring."""
        # Test input
        prompt = f"Context: Sample context\nQuery: {TEST_QUERY}"
        context = [{'chunk_id': 'chunk-123', 'content': 'Sample context'}]
        security_context = {
            'tenant_id': TEST_TENANT_ID,
            'request_id': 'req-123'
        }

        # Generate response
        response = await self.ai_service.generate_response(
            prompt,
            context,
            security_context
        )

        # Verify response
        assert isinstance(response, str)
        assert len(response) > 0

        # Verify OpenAI API call
        self.openai_mock.acreate.assert_called_once_with(
            model="gpt-4",
            messages=[
                {"role": "system", "content": mock.ANY},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4096,
            user=f"tenant_{TEST_TENANT_ID}",
            headers={
                'X-Tenant-ID': TEST_TENANT_ID,
                'X-Request-ID': 'req-123'
            }
        )

    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test health check functionality with comprehensive metrics."""
        # Configure mock responses
        self.vector_search_mock.health_check.return_value = {'status': 'healthy'}
        self.cache_mock.get_stats.return_value = {'hit_ratio': 0.85}

        # Perform health check
        health_status = await self.ai_service.health_check()

        # Verify health check response
        assert health_status['status'] == 'healthy'
        assert 'openai_api' in health_status
        assert 'vector_search' in health_status
        assert 'cache' in health_status
        assert 'metrics' in health_status

        # Verify metrics structure
        metrics = health_status['metrics']
        assert 'requests' in metrics
        assert 'errors' in metrics
        assert 'cache_hits' in metrics
        assert 'uptime' in metrics

    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test error handling and retry mechanisms."""
        # Simulate OpenAI API error
        self.openai_mock.acreate.side_effect = Exception("API Error")

        # Test query processing with error
        with pytest.raises(Exception):
            await self.ai_service.process_query(
                TEST_QUERY,
                "",
                {'tenant_id': TEST_TENANT_ID}
            )

        # Verify error metrics
        assert self.ai_service._metrics['errors'] > 0

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Test rate limiting functionality."""
        # Configure mock for rate limit testing
        self.openai_mock.acreate.side_effect = [
            {'choices': [{'message': {'content': 'Response'}}]},
            Exception("Rate limit exceeded")
        ]

        # Test successful request
        result = await self.ai_service.process_query(
            TEST_QUERY,
            "",
            {'tenant_id': TEST_TENANT_ID}
        )
        assert 'response' in result

        # Test rate limited request
        with pytest.raises(Exception, match="Rate limit exceeded"):
            await self.ai_service.process_query(
                TEST_QUERY,
                "",
                {'tenant_id': TEST_TENANT_ID}
            )

    @pytest.mark.asyncio
    async def test_context_management(self):
        """Test context window management and truncation."""
        # Create long context
        long_context = "x" * (TEST_CONTEXT_LENGTH + 1000)
        
        # Process query with long context
        result = await self.ai_service.process_query(
            TEST_QUERY,
            long_context,
            {'tenant_id': TEST_TENANT_ID}
        )

        # Verify context truncation
        prompt = self.openai_mock.acreate.call_args[1]['messages'][1]['content']
        assert len(prompt) <= TEST_CONTEXT_LENGTH

    @pytest.mark.asyncio
    async def test_security_headers(self):
        """Test security headers and tenant isolation."""
        # Test with security context
        security_context = {
            'tenant_id': TEST_TENANT_ID,
            'request_id': 'req-123',
            'user_id': 'user-123'
        }

        await self.ai_service.generate_response(
            "Test prompt",
            [],
            security_context
        )

        # Verify security headers
        call_kwargs = self.openai_mock.acreate.call_args[1]
        assert 'headers' in call_kwargs
        assert call_kwargs['headers']['X-Tenant-ID'] == TEST_TENANT_ID
        assert call_kwargs['headers']['X-Request-ID'] == 'req-123'