"""
Comprehensive test suite for the AI service module implementing GPT-4 based natural language
processing and response generation functionality.

Version: 1.0.0
"""

import pytest  # version: 7.4.0
import pytest_asyncio  # version: 0.21.0
import numpy as np
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

from app.services.ai_service import AIService
from app.services.vector_search import VectorSearchService
from app.services.cache_service import CacheService
from app.core.config import settings
from app.constants import VectorSearchConfig

# Test constants
TEST_TENANT_ID = "test-tenant-123"
TEST_VECTOR_DIMENSION = VectorSearchConfig.VECTOR_DIMENSION.value
TEST_QUERY = "What are the specifications of pump model A123?"
TEST_CONTEXT = "Model A123 Specifications: Flow rate: 500 GPM, Pressure: 150 PSI"

@pytest.fixture
def mock_openai():
    """Fixture providing mocked OpenAI client with security validation."""
    with patch("openai.Embedding.acreate") as mock_embed:
        with patch("openai.ChatCompletion.acreate") as mock_chat:
            # Configure embedding mock
            mock_embed.return_value = {
                "data": [{
                    "embedding": np.random.rand(TEST_VECTOR_DIMENSION).tolist()
                }]
            }
            
            # Configure chat completion mock
            mock_chat.return_value = AsyncMock(
                choices=[
                    Mock(
                        message=Mock(
                            content="The pump model A123 has the following specifications:\n- Flow rate: 500 GPM\n- Pressure: 150 PSI"
                        )
                    )
                ]
            )
            
            yield {
                "embedding": mock_embed,
                "chat": mock_chat
            }

@pytest.fixture
def mock_vector_search():
    """Fixture providing mocked vector search service."""
    mock = AsyncMock(spec=VectorSearchService)
    mock.search.return_value = [
        {
            "chunk_id": "chunk-123",
            "content": TEST_CONTEXT,
            "similarity_score": 0.95,
            "metadata": {"document_id": "doc-123"}
        }
    ]
    return mock

@pytest.fixture
def mock_cache():
    """Fixture providing mocked cache service."""
    mock = AsyncMock(spec=CacheService)
    mock.get.return_value = None
    mock.set.return_value = True
    return mock

@pytest.fixture
def test_security_context():
    """Fixture providing security context for tests."""
    return {
        "tenant_id": TEST_TENANT_ID,
        "user_context": {
            "user_id": "user-123",
            "role": "regular_user",
            "permissions": ["read"]
        }
    }

class TestAIService:
    """Test class for AIService functionality including security and performance."""

    def setup_method(self):
        """Set up test fixtures and security context."""
        self._vector_search_mock = Mock(spec=VectorSearchService)
        self._cache_mock = Mock(spec=CacheService)
        self._ai_service = AIService(
            vector_search_service=self._vector_search_mock,
            cache_service=self._cache_mock,
            tenant_id=TEST_TENANT_ID
        )

    def teardown_method(self):
        """Clean up test environment and security context."""
        self._vector_search_mock.reset_mock()
        self._cache_mock.reset_mock()

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_generate_embeddings(self, mock_openai):
        """Test embedding generation with security validation."""
        # Test input
        test_text = "Sample text for embedding generation"
        test_metadata = {"type": "test", "source": "unit_test"}

        # Generate embeddings
        embedding = await self._ai_service.generate_embeddings(test_text, test_metadata)

        # Verify embedding shape
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (TEST_VECTOR_DIMENSION,)

        # Verify OpenAI API call
        mock_openai["embedding"].assert_called_once_with(
            input=test_text,
            model="text-embedding-ada-002",
            user=TEST_TENANT_ID
        )

        # Test input validation
        with pytest.raises(ValueError):
            await self._ai_service.generate_embeddings("", test_metadata)
        with pytest.raises(ValueError):
            await self._ai_service.generate_embeddings(None, test_metadata)

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_process_query(self, mock_openai, mock_vector_search, mock_cache, test_security_context):
        """Test query processing with context retrieval."""
        # Configure mocks
        self._ai_service._vector_search = mock_vector_search
        self._ai_service._cache = mock_cache

        # Test query processing
        result = await self._ai_service.process_query(
            TEST_QUERY,
            chat_history="",
            user_context=test_security_context["user_context"]
        )

        # Verify result structure
        assert isinstance(result, dict)
        assert "answer" in result
        assert "context" in result
        assert "metadata" in result

        # Verify vector search call
        mock_vector_search.search.assert_called_once()
        search_args = mock_vector_search.search.call_args[0]
        assert isinstance(search_args[0], np.ndarray)
        assert search_args[1] == TEST_TENANT_ID

        # Verify cache interaction
        mock_cache.get.assert_called_once()
        mock_cache.set.assert_called_once()

        # Test error handling
        mock_vector_search.search.side_effect = Exception("Search failed")
        with pytest.raises(Exception):
            await self._ai_service.process_query(
                TEST_QUERY,
                chat_history="",
                user_context=test_security_context["user_context"]
            )

    @pytest.mark.asyncio
    @pytest.mark.security
    async def test_tenant_isolation(self, mock_openai, test_security_context):
        """Test multi-tenant data isolation and security."""
        # Test cross-tenant access attempt
        different_tenant = "different-tenant"
        with pytest.raises(ValueError):
            await self._ai_service.generate_embeddings(
                "Test text",
                {"tenant_id": different_tenant}
            )

        # Verify tenant ID in API calls
        await self._ai_service.generate_embeddings(
            "Test text",
            {"tenant_id": TEST_TENANT_ID}
        )
        mock_openai["embedding"].assert_called_with(
            input="Test text",
            model="text-embedding-ada-002",
            user=TEST_TENANT_ID
        )

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_generate_response(self, mock_openai, test_security_context):
        """Test response generation with security context."""
        # Test input
        test_prompt = "Generate response for test"
        test_context = [{"content": TEST_CONTEXT, "similarity_score": 0.95}]

        # Generate response
        response = await self._ai_service.generate_response(
            test_prompt,
            test_context,
            test_security_context
        )

        # Verify response
        assert isinstance(response, str)
        assert len(response) > 0

        # Verify GPT-4 API call
        mock_openai["chat"].assert_called_once()
        call_args = mock_openai["chat"].call_args[1]
        assert call_args["user"] == TEST_TENANT_ID
        assert call_args["temperature"] == 0.7
        assert call_args["max_tokens"] == 4096

        # Test security validation
        with pytest.raises(ValueError):
            await self._ai_service.generate_response(
                test_prompt,
                test_context,
                {}  # Invalid security context
            )

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_health_check(self, mock_openai):
        """Test health check functionality."""
        # Perform health check
        health_status = await self._ai_service.health_check()

        # Verify health status
        assert isinstance(health_status, dict)
        assert "status" in health_status
        assert "components" in health_status
        assert "metrics" in health_status
        assert "timestamp" in health_status

        # Test component status
        assert all(
            component in health_status["components"]
            for component in ["openai", "vector_search", "cache"]
        )

        # Test metrics
        assert all(
            metric in health_status["metrics"]
            for metric in ["requests", "errors", "cache_hits", "avg_latency"]
        )

        # Test error handling
        mock_openai["embedding"].side_effect = Exception("API error")
        error_status = await self._ai_service.health_check()
        assert error_status["status"] == "unhealthy"
        assert "error" in error_status