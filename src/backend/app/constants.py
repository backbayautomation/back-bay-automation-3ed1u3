"""
Constants module for the AI-powered Product Catalog Search System.
Contains system-wide enums, configuration constants, and status codes.

Version: 1.0
"""

from enum import Enum, unique  # version: latest

# Project Configuration Constants
PROJECT_NAME = "AI-Powered Product Catalog Search"
API_V1_PREFIX = "/api/v1"

# Document Processing Constants
SUPPORTED_FILE_TYPES = ["pdf", "docx", "xlsx"]
MAX_FILE_SIZE_MB = 50
DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 200
MAX_CONCURRENT_PROCESSING = 10

# Rate Limiting Constants
RATE_LIMIT_REQUESTS = 1000  # requests per hour
RATE_LIMIT_PERIOD = 3600   # period in seconds

@unique
class DocumentStatus(Enum):
    """
    Enum representing possible states of a document in the processing pipeline.
    Used for tracking document status throughout the ingestion and processing workflow.
    """
    PENDING = "pending"        # Document uploaded but not yet queued
    QUEUED = "queued"         # Document in processing queue
    PROCESSING = "processing"  # Document currently being processed
    COMPLETED = "completed"    # Document successfully processed
    FAILED = "failed"         # Processing failed with error
    INVALID = "invalid"       # Document validation failed

@unique
class UserRole(Enum):
    """
    Enum defining hierarchical user roles with specific permission levels.
    Used for implementing role-based access control (RBAC) across the system.
    """
    SYSTEM_ADMIN = "system_admin"   # Full system access and configuration
    CLIENT_ADMIN = "client_admin"   # Full access to client-specific resources
    POWER_USER = "power_user"       # Enhanced access to features
    REGULAR_USER = "regular_user"   # Standard feature access
    READ_ONLY = "read_only"         # Read-only access to resources

@unique
class ErrorCode(Enum):
    """
    Comprehensive enum of system error codes for exception handling.
    Provides standardized error codes for system-wide error handling and reporting.
    """
    INVALID_CREDENTIALS = "invalid_credentials"
    DOCUMENT_NOT_FOUND = "document_not_found"
    PROCESSING_ERROR = "processing_error"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    INVALID_FILE_TYPE = "invalid_file_type"
    FILE_SIZE_EXCEEDED = "file_size_exceeded"
    PROCESSING_QUEUE_FULL = "processing_queue_full"
    VECTOR_STORE_ERROR = "vector_store_error"

@unique
class VectorSearchConfig(Enum):
    """
    Vector search configuration constants based on technical specifications A.1.1.
    Defines parameters for vector processing and similarity search operations.
    """
    VECTOR_DIMENSION = 1536           # Dimension of the vector embeddings
    SIMILARITY_THRESHOLD = 0.8        # Minimum similarity score threshold
    TOP_K_RESULTS = 5                # Number of top results to return
    CONTEXT_WINDOW_SIZE = 8192       # Size of context window in tokens
    BATCH_SIZE = 32                  # Batch size for vector processing
    DISTANCE_METRIC = "cosine"       # Distance metric for similarity calculation