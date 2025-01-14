"""
Pydantic schema models for handling natural language queries and search requests.
Implements comprehensive validation for query processing, vector search parameters, and response formats.
"""

# pydantic v2.0.0
from pydantic import BaseModel, Field, ConfigDict, UUID4
from typing import List, Optional, Dict, Any
from datetime import datetime

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
            "previous_context": "discussing flow rates"
        }]
    )
    request_id: Optional[str] = Field(
        default=None,
        description="Unique identifier for request tracing",
        examples=["req_123abc456def"]
    )
    telemetry: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Query telemetry data",
        examples=[{
            "client_timestamp": "2024-01-20T12:00:00Z",
            "client_info": {"browser": "Chrome", "version": "90.0"},
            "session_id": "sess_xyz789"
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
                "request_id": "req_123abc456def",
                "telemetry": {
                    "client_timestamp": "2024-01-20T12:00:00Z",
                    "client_info": {"browser": "Chrome", "version": "90.0"}
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
        description="Generated answer text",
        examples=["The pump model A123 has a flow rate of 500 GPM and pressure of 150 PSI."]
    )
    relevant_chunks: List[Chunk] = Field(
        default_factory=list,
        description="Relevant document chunks used for answer generation"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Response metadata and processing information",
        examples=[{
            "model_version": "gpt-4",
            "tokens_used": 150,
            "processing_steps": ["retrieval", "reranking", "generation"]
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
        examples=[0.45, 1.23, 2.56]
    )
    source_documents: List[str] = Field(
        default_factory=list,
        description="List of source document references",
        examples=[["tech_spec_123.pdf", "product_manual_456.docx"]]
    )
    error_message: Optional[str] = Field(
        default=None,
        description="Error message if query processing failed",
        examples=["Failed to retrieve relevant documents"]
    )
    telemetry_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Detailed telemetry data for monitoring",
        examples=[{
            "retrieval_time": 0.15,
            "generation_time": 0.30,
            "cache_hits": 0,
            "vector_operations": 125
        }]
    )
    cache_info: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Cache-related information",
        examples=[{
            "cache_hit": True,
            "cache_key": "query_xyz789",
            "ttl": 3600
        }]
    )

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "answer": "The pump model A123 has a flow rate of 500 GPM and pressure of 150 PSI.",
                "relevant_chunks": [],
                "metadata": {
                    "model_version": "gpt-4",
                    "tokens_used": 150,
                    "processing_steps": ["retrieval", "reranking", "generation"]
                },
                "confidence_score": 0.95,
                "processing_time": 0.45,
                "source_documents": ["tech_spec_123.pdf"],
                "error_message": None,
                "telemetry_data": {
                    "retrieval_time": 0.15,
                    "generation_time": 0.30,
                    "cache_hits": 0
                },
                "cache_info": {
                    "cache_hit": False,
                    "cache_key": "query_xyz789"
                }
            }
        }
    )