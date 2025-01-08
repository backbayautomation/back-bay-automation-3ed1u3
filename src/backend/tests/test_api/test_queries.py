import pytest
import pytest_asyncio
import httpx
import time
from typing import Dict, Any
from uuid import uuid4

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
            "context": {
                "document_type": "technical_spec",
                "product_category": "pumps"
            },
            "request_id": str(uuid4())
        },
        "chat_query": {
            "query_text": "What is its flow rate?",
            "context": {
                "previous_queries": ["Show me pump model A123 specifications"],
                "chat_history": [
                    {"role": "user", "content": "Show me pump model A123 specifications"},
                    {"role": "assistant", "content": "Here are the specifications for pump model A123..."}
                ]
            },
            "request_id": str(uuid4())
        },
        "expected_chunks": [
            {
                "content": "Technical specifications for the A123 pump model include flow rate of 500 GPM...",
                "metadata": {"page_number": 1, "confidence": 0.95}
            }
        ]
    }

@pytest_asyncio.fixture
async def test_chat_session() -> ChatSession:
    """Fixture creating test chat session."""
    return ChatSession(
        id=str(uuid4()),
        context={
            "product_focus": "pumps",
            "chat_history": []
        },
        created_at=time.time()
    )

class TestQueryEndpoints:
    """Test class for query processing endpoints with enhanced validation."""

    def setup_method(self):
        """Setup method for test initialization."""
        self.base_url = "/api/v1/queries"
        self.performance_threshold = 0.2  # 80% reduction target

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_process_query(self, test_client: httpx.AsyncClient, auth_headers: Dict, test_query_data: Dict):
        """Test successful processing of a natural language query with timing validation."""
        # Record start time
        start_time = time.time()

        # Configure test query
        query_data = {
            **test_query_data["basic_query"],
            "search_params": SearchParameters(
                top_k=5,
                similarity_threshold=0.8,
                context_window=8192
            ).model_dump()
        }

        # Send query request
        response = await test_client.post(
            f"{self.base_url}/process",
            json=query_data,
            headers=auth_headers
        )

        # Calculate processing time
        processing_time = time.time() - start_time

        # Verify performance target
        assert processing_time <= self.performance_threshold, f"Query processing time {processing_time}s exceeded threshold {self.performance_threshold}s"

        # Validate response
        assert response.status_code == 200
        result = QueryResult(**response.json())

        # Validate response structure
        assert result.answer, "Response must contain an answer"
        assert len(result.relevant_chunks) > 0, "Response must include relevant chunks"
        assert result.confidence_score >= 0.8, "Confidence score must meet minimum threshold"
        assert all(chunk.content for chunk in result.relevant_chunks), "All chunks must contain content"
        assert result.processing_time > 0, "Processing time must be recorded"
        assert result.source_documents, "Source documents must be listed"

        # Validate vector search results
        chunks = result.relevant_chunks
        assert all(hasattr(chunk, 'embedding') for chunk in chunks), "All chunks must have embeddings"
        assert all(float(chunk.metadata.get('similarity', 0)) >= 0.8 for chunk in chunks), "Chunks must meet similarity threshold"

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_process_chat_query(
        self, 
        test_client: httpx.AsyncClient, 
        auth_headers: Dict,
        test_chat_session: ChatSession
    ):
        """Test processing of chat queries with context preservation."""
        # Initial context-setting query
        initial_query = {
            **test_query_data["basic_query"],
            "session_id": test_chat_session.id
        }

        response = await test_client.post(
            f"{self.base_url}/chat",
            json=initial_query,
            headers=auth_headers
        )

        assert response.status_code == 200
        initial_result = QueryResult(**response.json())
        assert initial_result.metadata.get("session_id") == test_chat_session.id

        # Follow-up query with context
        follow_up_query = {
            **test_query_data["chat_query"],
            "session_id": test_chat_session.id
        }

        response = await test_client.post(
            f"{self.base_url}/chat",
            json=follow_up_query,
            headers=auth_headers
        )

        assert response.status_code == 200
        follow_up_result = QueryResult(**response.json())

        # Validate context preservation
        assert "flow rate" in follow_up_result.answer.lower()
        assert follow_up_result.metadata.get("context_used") is True
        assert len(follow_up_result.metadata.get("chat_history", [])) >= 2

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_get_query_history(self, test_client: httpx.AsyncClient, auth_headers: Dict):
        """Test query history retrieval with pagination."""
        # Create test queries
        for _ in range(3):
            query_data = {
                **test_query_data["basic_query"],
                "request_id": str(uuid4())
            }
            await test_client.post(
                f"{self.base_url}/process",
                json=query_data,
                headers=auth_headers
            )

        # Test history retrieval with pagination
        response = await test_client.get(
            f"{self.base_url}/history",
            params={"page": 1, "page_size": 2},
            headers=auth_headers
        )

        assert response.status_code == 200
        history = response.json()

        # Validate pagination
        assert "items" in history
        assert "total" in history
        assert "page" in history
        assert len(history["items"]) <= 2

        # Validate history items
        for item in history["items"]:
            assert "query_text" in item
            assert "timestamp" in item
            assert "result" in item
            assert "processing_time" in item

        # Test date range filtering
        response = await test_client.get(
            f"{self.base_url}/history",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        filtered_history = response.json()
        assert all(
            "2024" in item["timestamp"] 
            for item in filtered_history["items"]
        )