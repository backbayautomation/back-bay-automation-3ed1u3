# pydantic v2.0.0
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, UUID4

from app.schemas.chunk import Chunk

class QueryBase(BaseModel):
    """Base Pydantic model for natural language queries with enhanced validation."""
    query_text: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="Natural language query text",
        examples=["What are the specifications for pump model A123?"]
    )
    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional context for query processing",
        examples=[{
            "document_type": "technical_spec",
            "product_category": "pumps",
            "previous_queries": ["Show me all pump models"]
        }]
    )
    request_id: Optional[str] = Field(
        default=None,
        description="Unique identifier for request tracing",
        examples=["req_123e4567-e89b-12d3-a456-426614174000"]
    )
    telemetry: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Query telemetry data",
        examples=[{
            "client_id": "123e4567-e89b-12d3-a456-426614174000",
            "timestamp": "2024-01-20T12:00:00Z",
            "user_agent": "Mozilla/5.0",
            "session_id": "sess_987fcdeb"
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "query_text": "What are the specifications for pump model A123?",
                "context": {
                    "document_type": "technical_spec",
                    "product_category": "pumps"
                },
                "request_id": "req_123e4567-e89b-12d3-a456-426614174000",
                "telemetry": {
                    "client_id": "123e4567-e89b-12d3-a456-426614174000",
                    "timestamp": "2024-01-20T12:00:00Z"
                }
            }
        }
    )

class SearchParameters(BaseModel):
    """Pydantic model for vector search configuration with enhanced validation."""
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of top results to return",
        examples=[5, 10, 20]
    )
    similarity_threshold: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score for results",
        examples=[0.8, 0.9, 0.95]
    )
    context_window: int = Field(
        default=8192,
        ge=1024,
        le=16384,
        description="Size of context window in tokens",
        examples=[4096, 8192, 16384]
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "top_k": 5,
                "similarity_threshold": 0.8,
                "context_window": 8192
            }
        }
    )

class QueryResult(BaseModel):
    """Enhanced Pydantic model for query response with telemetry and error handling."""
    answer: str = Field(
        ...,
        description="Generated answer text",
        examples=["The A123 pump model has a flow rate of 500 GPM and pressure of 150 PSI."]
    )
    relevant_chunks: List[Chunk] = Field(
        ...,
        description="List of relevant document chunks used for answer generation",
        min_items=1
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Response metadata and processing information",
        examples=[{
            "model_version": "gpt-4",
            "tokens_used": 150,
            "processing_steps": ["retrieval", "synthesis", "validation"]
        }]
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score for the generated answer",
        examples=[0.95, 0.87, 0.75]
    )
    processing_time: float = Field(
        ...,
        ge=0.0,
        description="Total processing time in seconds",
        examples=[0.45, 1.23, 2.01]
    )
    source_documents: List[str] = Field(
        ...,
        description="List of source document references",
        examples=[
            ["technical_spec_a123.pdf", "pump_catalog_2024.pdf"]
        ]
    )
    error_message: Optional[str] = Field(
        None,
        description="Error message if query processing failed",
        examples=["Failed to retrieve relevant documents"]
    )
    telemetry_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Detailed telemetry data for monitoring and analytics",
        examples=[{
            "request_id": "req_123e4567",
            "timestamp": "2024-01-20T12:00:00Z",
            "vector_search_time": 0.15,
            "llm_processing_time": 0.85
        }]
    )
    cache_info: Optional[Dict[str, Any]] = Field(
        None,
        description="Cache hit/miss information",
        examples=[{
            "cache_hit": True,
            "cache_key": "query_12345",
            "ttl": 3600
        }]
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "answer": "The A123 pump model has a flow rate of 500 GPM and pressure of 150 PSI.",
                "relevant_chunks": [],
                "metadata": {
                    "model_version": "gpt-4",
                    "tokens_used": 150
                },
                "confidence_score": 0.95,
                "processing_time": 1.23,
                "source_documents": ["technical_spec_a123.pdf"],
                "telemetry_data": {
                    "request_id": "req_123e4567",
                    "timestamp": "2024-01-20T12:00:00Z"
                }
            }
        }
    )