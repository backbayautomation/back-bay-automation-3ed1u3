"""
Pydantic schema models for handling natural language queries and search requests.
Implements comprehensive validation for query processing, vector search parameters,
response formats, and telemetry data.
"""

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
            "document_ids": ["123e4567-e89b-12d3-a456-426614174000"],
            "filters": {"product_type": "pump", "model": "A123"}
        }]
    )
    request_id: Optional[str] = Field(
        default=None,
        description="Unique identifier for request tracing",
        examples=["req_123abc456def"]
    )
    telemetry: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Request telemetry data",
        examples=[{
            "client_id": "client_123",
            "session_id": "sess_456",
            "timestamp": "2024-01-20T12:00:00Z"
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "query_text": "What are the specifications for pump model A123?",
                "context": {
                    "document_ids": ["123e4567-e89b-12d3-a456-426614174000"],
                    "filters": {"product_type": "pump", "model": "A123"}
                },
                "request_id": "req_123abc456def",
                "telemetry": {
                    "client_id": "client_123",
                    "session_id": "sess_456",
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
        populate_by_name=True,
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
        min_length=1,
        description="Generated answer text",
        examples=["The A123 pump model has a flow rate of 500 GPM and pressure of 150 PSI."]
    )
    relevant_chunks: List[Chunk] = Field(
        ...,
        min_items=1,
        description="Relevant document chunks used for answer generation"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Response metadata",
        examples=[{
            "model": "gpt-4",
            "tokens_used": 150,
            "confidence": 0.95
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
        description="Query processing time in seconds",
        examples=[0.45, 1.23, 2.01]
    )
    source_documents: List[str] = Field(
        ...,
        description="List of source document references",
        examples=[["Technical Manual p.45", "Product Catalog 2024 p.12"]]
    )
    error_message: Optional[str] = Field(
        None,
        description="Error message if query processing failed",
        examples=["Failed to retrieve relevant documents"]
    )
    telemetry_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Response telemetry data",
        examples=[{
            "request_id": "req_123abc456def",
            "timestamp": "2024-01-20T12:00:00Z",
            "cache_hit": False,
            "vector_search_time": 0.15
        }]
    )
    cache_info: Optional[Dict[str, Any]] = Field(
        None,
        description="Cache-related information",
        examples=[{
            "cache_hit": True,
            "cache_key": "query_123abc",
            "ttl": 3600
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "answer": "The A123 pump model has a flow rate of 500 GPM and pressure of 150 PSI.",
                "relevant_chunks": [],  # Will be populated with Chunk objects
                "metadata": {
                    "model": "gpt-4",
                    "tokens_used": 150,
                    "confidence": 0.95
                },
                "confidence_score": 0.95,
                "processing_time": 0.45,
                "source_documents": ["Technical Manual p.45", "Product Catalog 2024 p.12"],
                "error_message": None,
                "telemetry_data": {
                    "request_id": "req_123abc456def",
                    "timestamp": "2024-01-20T12:00:00Z",
                    "cache_hit": False,
                    "vector_search_time": 0.15
                },
                "cache_info": {
                    "cache_hit": True,
                    "cache_key": "query_123abc",
                    "ttl": 3600
                }
            }
        }
    )