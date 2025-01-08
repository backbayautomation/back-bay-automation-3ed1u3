"""
Test suite for the queries API endpoints, validating natural language query processing,
vector search functionality, chat session handling, and query history management.
"""

import pytest
import pytest_asyncio
import time
from typing import Dict, Any

from app.schemas.query import (
    QueryCreate,
    QueryResult,
    SearchParameters,
    ChatSession,
    QueryHistory
)

@pytest.fixture
def test_query_data() -> Dict[str, Any]:
    """Fixture providing sample queries and expected responses."""
    return {
        "basic_query": {
            "query_text": "What are the specifications for pump model A123?",
            "expected_sources": ["Technical Manual p.45", "Product Catalog 2024 p.12"],
            "expected_content": ["flow rate", "pressure", "power"],
            "search_params": {
                "top_k": 5,
                "similarity_threshold": 0.8,
                "context_window": 8192
            }
        },
        "chat_query": {
            "initial_query": "Tell me about pump model A123",
            "follow_up": "What is its flow rate?",
            "context": {
                "document_ids": ["123e4567-e89b-12d3-a456-426614174000"],
                "filters": {"product_type": "pump", "model": "A123"}
            }
        }
    }

@pytest.fixture
async def test_chat_session(test_client) -> ChatSession:
    """Fixture creating test chat session."""
    session_data = {
        "session_id": "test_session_123",
        "context": {
            "document_ids": ["123e4567-e89b-12d3-a456-426614174000"],
            "conversation_history": []
        }
    }
    response = await test_client.post("/api/v1/chat/sessions", json=session_data)
    assert response.status_code == 201
    return ChatSession(**response.json())

class TestQueryEndpoints:
    """Test class for query processing endpoints with enhanced validation."""

    def __init__(self):
        self.base_url = "/api/v1/queries"
        self.performance_threshold = 0.2  # 80% reduction target from baseline 1.0s

    async def setup_method(self):
        """Setup method for test initialization."""
        self.test_queries = {
            "basic": QueryCreate(
                query_text="What are the specifications for pump model A123?",
                search_params=SearchParameters(
                    top_k=5,
                    similarity_threshold=0.8,
                    context_window=8192
                )
            ),
            "complex": QueryCreate(
                query_text="Compare flow rates between pump models A123 and B456",
                search_params=SearchParameters(
                    top_k=10,
                    similarity_threshold=0.85,
                    context_window=12288
                )
            )
        }

    async def teardown_method(self):
        """Cleanup method after tests."""
        # Clean up test data and sessions
        pass

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_process_query(self, test_client, auth_headers, test_query_data):
        """Test successful processing of a natural language query with timing validation."""
        # Record start time
        start_time = time.time()

        # Create test query
        query = QueryCreate(
            query_text=test_query_data["basic_query"]["query_text"],
            search_params=SearchParameters(**test_query_data["basic_query"]["search_params"])
        )

        # Send query request
        response = await test_client.post(
            f"{self.base_url}",
            json=query.model_dump(),
            headers=auth_headers
        )

        # Calculate processing time
        processing_time = time.time() - start_time

        # Verify performance target
        assert processing_time <= self.performance_threshold, \
            f"Query processing time {processing_time}s exceeded threshold {self.performance_threshold}s"

        # Validate response
        assert response.status_code == 200
        result = QueryResult(**response.json())

        # Validate answer content
        assert any(content in result.answer.lower() for content in test_query_data["basic_query"]["expected_content"]), \
            "Answer missing expected content"

        # Validate source documents
        assert any(source in result.source_documents for source in test_query_data["basic_query"]["expected_sources"]), \
            "Expected source documents not found in response"

        # Validate confidence and relevance
        assert 0.0 <= result.confidence_score <= 1.0, "Invalid confidence score range"
        assert len(result.relevant_chunks) > 0, "No relevant chunks returned"
        assert all(chunk.metadata.get("confidence", 0) >= 0.8 for chunk in result.relevant_chunks), \
            "Low confidence chunks in results"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_process_chat_query(self, test_client, auth_headers, test_chat_session):
        """Test processing of chat queries with context preservation."""
        # Send initial query
        initial_response = await test_client.post(
            f"{self.base_url}/chat",
            json={
                "query_text": "Tell me about pump model A123",
                "session_id": test_chat_session.session_id
            },
            headers=auth_headers
        )
        assert initial_response.status_code == 200
        initial_result = QueryResult(**initial_response.json())

        # Send follow-up query
        follow_up_response = await test_client.post(
            f"{self.base_url}/chat",
            json={
                "query_text": "What is its flow rate?",
                "session_id": test_chat_session.session_id
            },
            headers=auth_headers
        )
        assert follow_up_response.status_code == 200
        follow_up_result = QueryResult(**follow_up_response.json())

        # Validate context preservation
        assert "500 GPM" in follow_up_result.answer, "Context not preserved in follow-up response"
        assert follow_up_result.metadata.get("context_used") is True, "Context not utilized"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_query_history(self, test_client, auth_headers):
        """Test query history retrieval with pagination."""
        # Get query history
        response = await test_client.get(
            f"{self.base_url}/history",
            params={
                "page": 1,
                "page_size": 10,
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        history = response.json()

        # Validate pagination
        assert "items" in history
        assert "total" in history
        assert "page" in history
        assert "pages" in history

        # Validate history items
        if history["items"]:
            item = history["items"][0]
            assert "query_text" in item
            assert "timestamp" in item
            assert "processing_time" in item
            assert "confidence_score" in item

        # Test invalid page
        invalid_response = await test_client.get(
            f"{self.base_url}/history",
            params={"page": 9999},
            headers=auth_headers
        )
        assert invalid_response.status_code == 404