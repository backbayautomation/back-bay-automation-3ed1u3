"""
Pydantic schema definitions for analytics data models in the AI-powered Product Catalog Search System.
Implements comprehensive validation rules for usage metrics, performance monitoring, and analytics dashboard.
"""

from pydantic import BaseModel, Field, validator, root_validator
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

class UsageMetrics(BaseModel):
    """Schema for system usage metrics with validation rules."""
    
    total_queries: int = Field(
        ge=0,
        description="Total number of queries processed"
    )
    unique_users: int = Field(
        ge=0,
        description="Number of unique users"
    )
    avg_response_time: float = Field(
        ge=0,
        description="Average query response time in milliseconds"
    )
    success_rate: float = Field(
        ge=0,
        le=100,
        description="Query success rate as percentage"
    )
    query_distribution: Dict[str, int] = Field(
        description="Distribution of query types"
    )

    @validator('success_rate')
    def validate_rates(cls, value: float) -> float:
        """Validate rate fields are within valid ranges."""
        if not 0 <= value <= 100:
            raise ValueError("Success rate must be between 0 and 100")
        return value

    @validator('avg_response_time')
    def validate_response_time(cls, value: float) -> float:
        """Validate average response time is reasonable."""
        if not 0 <= value <= 60000:  # Max 60 seconds
            raise ValueError("Average response time must be between 0 and 60000ms")
        return value

class DocumentMetrics(BaseModel):
    """Schema for document processing metrics with count validation."""
    
    total_documents: int = Field(
        ge=0,
        description="Total number of documents processed"
    )
    failed_documents: int = Field(
        ge=0,
        description="Number of failed document processing attempts"
    )
    avg_processing_time: float = Field(
        ge=0,
        description="Average document processing time in seconds"
    )
    document_types: Dict[str, int] = Field(
        description="Distribution of document types"
    )

    @root_validator
    def validate_counts(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate document counts are non-negative and consistent."""
        total = values.get('total_documents', 0)
        failed = values.get('failed_documents', 0)
        types = values.get('document_types', {})

        if failed > total:
            raise ValueError("Failed documents cannot exceed total documents")

        if sum(types.values()) != total:
            raise ValueError("Sum of document types must equal total documents")

        return values

class PerformanceMetrics(BaseModel):
    """Schema for system performance metrics with threshold validation."""
    
    cpu_usage: float = Field(
        ge=0,
        le=100,
        description="CPU usage percentage"
    )
    memory_usage: float = Field(
        ge=0,
        le=100,
        description="Memory usage percentage"
    )
    api_latency: float = Field(
        ge=0,
        description="API endpoint latency in milliseconds"
    )
    search_latency: float = Field(
        ge=0,
        description="Search operation latency in milliseconds"
    )
    uptime: float = Field(
        ge=0,
        description="System uptime in seconds"
    )

    @root_validator
    def validate_resource_usage(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate resource usage metrics are within thresholds."""
        if not 0 <= values.get('cpu_usage', 0) <= 100:
            raise ValueError("CPU usage must be between 0 and 100")
        
        if not 0 <= values.get('memory_usage', 0) <= 100:
            raise ValueError("Memory usage must be between 0 and 100")
        
        if values.get('api_latency', 0) > 10000:  # Max 10 seconds
            raise ValueError("API latency exceeds maximum threshold")
            
        if values.get('search_latency', 0) > 5000:  # Max 5 seconds
            raise ValueError("Search latency exceeds maximum threshold")

        return values

class TimeSeriesData(BaseModel):
    """Schema for time series analytics data with consistency validation."""
    
    metric_name: str = Field(
        min_length=1,
        max_length=100,
        description="Name of the metric being tracked"
    )
    timestamps: List[datetime] = Field(
        description="List of UTC timestamps"
    )
    values: List[float] = Field(
        description="List of metric values"
    )
    unit: Optional[str] = Field(
        default=None,
        description="Optional unit of measurement"
    )

    @root_validator
    def validate_series(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate time series data consistency."""
        timestamps = values.get('timestamps', [])
        metric_values = values.get('values', [])

        if len(timestamps) != len(metric_values):
            raise ValueError("Timestamps and values must have equal length")

        # Verify timestamps are in UTC and ordered
        for i in range(len(timestamps)):
            if timestamps[i].tzinfo is not None:
                raise ValueError("Timestamps must be in UTC")
            if i > 0 and timestamps[i] <= timestamps[i-1]:
                raise ValueError("Timestamps must be strictly increasing")

        return values

class AnalyticsDashboard(BaseModel):
    """Schema for complete analytics dashboard data with relationship validation."""
    
    tenant_id: UUID = Field(
        description="Organization ID for multi-tenant isolation"
    )
    timestamp: datetime = Field(
        description="UTC timestamp of the analytics data"
    )
    usage: UsageMetrics = Field(
        description="System usage metrics"
    )
    documents: DocumentMetrics = Field(
        description="Document processing metrics"
    )
    performance: PerformanceMetrics = Field(
        description="System performance metrics"
    )
    trends: List[TimeSeriesData] = Field(
        description="Time series trends data"
    )

    @validator('tenant_id')
    def validate_tenant(cls, value: UUID) -> UUID:
        """Validate tenant_id references valid Organization."""
        # Note: Actual DB validation would be done at the service layer
        if not value:
            raise ValueError("tenant_id is required")
        return value

    @root_validator
    def validate_timestamps(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Validate timestamp consistency across metrics."""
        timestamp = values.get('timestamp')
        if timestamp and timestamp.tzinfo is not None:
            raise ValueError("Timestamp must be in UTC")

        # Verify trends don't extend beyond current timestamp
        trends = values.get('trends', [])
        for trend in trends:
            if any(ts > timestamp for ts in trend.timestamps):
                raise ValueError("Trend timestamps cannot be in the future")

        return values

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }