"""
Test suite for query processing endpoints validating natural language query processing,
vector search functionality, chat session handling, and query history management.
"""

import pytest
import pytest_asyncio
import time
from typing import Dict, Any

from app.schemas.query import (
    QueryBase, 
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
                "document_type": "technical_spec",
                "product_category": "pumps"
            }
        },
        "performance_target": 2.0  # Maximum allowed response time in seconds
    }

@pytest_asyncio.fixture
async def test_chat_session(test_client) -> ChatSession:
    """Fixture creating test chat session with initialized context."""
    session_data = {
        "session_id": "test_session_123",
        "context": {
            "document_type": "technical_spec",
            "product_category": "pumps",
            "previous_context": None
        }
    }
    response = await test_client.post("/api/v1/chat/sessions", json=session_data)
    assert response.status_code == 201
    return ChatSession(**response.json())

@pytest.mark.asyncio
@pytest.mark.integration
async def test_process_query(test_client, auth_headers, test_query_data):
    """Test successful processing of a natural language query with timing validation."""
    # Prepare test data
    query_data = test_query_data["basic_query"]
    search_params = SearchParameters(**query_data["search_params"])
    
    # Record start time for performance measurement
    start_time = time.time()
    
    # Send query request
    response = await test_client.post(
        "/api/v1/queries",
        json={
            "query_text": query_data["query_text"],
            "search_params": search_params.model_dump()
        },
        headers=auth_headers
    )
    
    # Calculate response time
    response_time = time.time() - start_time
    
    # Validate response
    assert response.status_code == 200
    result = QueryResult(**response.json())
    
    # Verify performance target
    assert response_time < test_query_data["performance_target"], \
        f"Query processing took {response_time}s, exceeding target of {test_query_data['performance_target']}s"
    
    # Validate response content
    assert all(term in result.answer.lower() for term in query_data["expected_content"]), \
        "Response missing expected content terms"
    assert result.confidence_score >= 0.8, "Confidence score below threshold"
    assert len(result.relevant_chunks) > 0, "No relevant chunks returned"
    
    # Verify vector search results
    chunks = result.relevant_chunks
    assert all(hasattr(chunk, "content") for chunk in chunks), "Invalid chunk format"
    assert all(float(chunk.metadata.get("similarity_score", 0)) >= search_params.similarity_threshold 
              for chunk in chunks), "Chunks below similarity threshold"

@pytest.mark.asyncio
@pytest.mark.integration
async def test_process_chat_query(test_client, auth_headers, test_chat_session):
    """Test processing of chat queries with context preservation."""
    chat_data = test_query_data["chat_query"]
    
    # Send initial query
    initial_response = await test_client.post(
        "/api/v1/queries/chat",
        json={
            "query_text": chat_data["initial_query"],
            "session_id": test_chat_session.session_id,
            "context": chat_data["context"]
        },
        headers=auth_headers
    )
    
    assert initial_response.status_code == 200
    initial_result = QueryResult(**initial_response.json())
    assert initial_result.metadata.get("session_id") == test_chat_session.session_id
    
    # Send follow-up query
    follow_up_response = await test_client.post(
        "/api/v1/queries/chat",
        json={
            "query_text": chat_data["follow_up"],
            "session_id": test_chat_session.session_id
        },
        headers=auth_headers
    )
    
    assert follow_up_response.status_code == 200
    follow_up_result = QueryResult(**follow_up_response.json())
    
    # Verify context preservation
    assert "flow rate" in follow_up_result.answer.lower()
    assert follow_up_result.metadata.get("context_preserved") is True
    assert len(follow_up_result.metadata.get("conversation_history", [])) > 0

@pytest.mark.asyncio
@pytest.mark.integration
async def test_get_query_history(test_client, auth_headers):
    """Test query history retrieval with pagination and filtering."""
    # Get query history
    response = await test_client.get(
        "/api/v1/queries/history",
        params={
            "page": 1,
            "page_size": 10,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 200
    history = QueryHistory(**response.json())
    
    # Validate pagination
    assert hasattr(history, "total")
    assert hasattr(history, "items")
    assert len(history.items) <= 10
    
    # Verify history items
    for item in history.items:
        assert hasattr(item, "query_text")
        assert hasattr(item, "timestamp")
        assert hasattr(item, "result")
        assert item.timestamp >= "2024-01-01"
        assert item.timestamp <= "2024-12-31"

class TestQueryEndpoints:
    """Test class for query processing endpoints with enhanced validation."""
    
    def setup_method(self):
        """Setup method for test initialization."""
        self.base_url = "/api/v1/queries"
        self.performance_threshold = 2.0
        self.test_queries = test_query_data
    
    def teardown_method(self):
        """Cleanup method after tests."""
        pass
    
    @pytest.mark.asyncio
    async def test_query_validation(self, test_client, auth_headers):
        """Test query input validation and error handling."""
        # Test invalid query
        response = await test_client.post(
            f"{self.base_url}",
            json={
                "query_text": "",  # Invalid empty query
                "search_params": {}
            },
            headers=auth_headers
        )
        assert response.status_code == 422
        
        # Test invalid search parameters
        response = await test_client.post(
            f"{self.base_url}",
            json={
                "query_text": "Valid query",
                "search_params": {
                    "top_k": 0,  # Invalid value
                    "similarity_threshold": 2.0  # Invalid value
                }
            },
            headers=auth_headers
        )
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_error_handling(self, test_client, auth_headers):
        """Test error handling for various failure scenarios."""
        # Test invalid session ID
        response = await test_client.post(
            f"{self.base_url}/chat",
            json={
                "query_text": "Test query",
                "session_id": "invalid_session_id"
            },
            headers=auth_headers
        )
        assert response.status_code == 404
        
        # Test invalid date range
        response = await test_client.get(
            f"{self.base_url}/history",
            params={
                "start_date": "2024-12-31",
                "end_date": "2024-01-01"  # Invalid range
            },
            headers=auth_headers
        )
        assert response.status_code == 400