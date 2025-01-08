"""
Core services module for the AI-powered Product Catalog Search System.

This module provides a centralized interface for accessing all service functionality
including document processing, AI operations, vector search, caching, authentication,
and analytics. Services are initialized in dependency order and support comprehensive
type hints for enhanced IDE support.

Version: 1.0.0
Author: AI-Powered Product Catalog Search System Team
"""

from .ocr_service import OCRService
from .ai_service import AIService
from .vector_search import VectorSearchService
from .cache_service import CacheService
from .auth import AuthService
from .document_processor import DocumentProcessorService
from .chat_service import ChatService
from .analytics_service import AnalyticsService

# Package metadata
__version__ = "1.0.0"
__author__ = "AI-Powered Product Catalog Search System Team"

# Export all service classes
__all__ = [
    "OCRService",
    "AIService",
    "VectorSearchService",
    "CacheService",
    "AuthService",
    "DocumentProcessorService",
    "ChatService",
    "AnalyticsService"
]

# Service initialization order based on dependencies
SERVICE_INITIALIZATION_ORDER = [
    "CacheService",      # Base caching functionality
    "AuthService",       # Authentication and security
    "OCRService",        # Document processing
    "AIService",         # AI and language model operations
    "VectorSearchService", # Vector similarity search
    "DocumentProcessorService", # Document pipeline orchestration
    "ChatService",       # Chat functionality
    "AnalyticsService"   # Analytics and monitoring
]

# Service descriptions for API documentation
SERVICE_DESCRIPTIONS = {
    "OCRService": "GPU-accelerated document OCR processing using NVidia OCR SDK",
    "AIService": "GPT-4 powered natural language processing and response generation",
    "VectorSearchService": "High-dimensional vector similarity search with tenant isolation",
    "CacheService": "Redis-based caching with TTL management and monitoring",
    "AuthService": "Enterprise-grade authentication and authorization",
    "DocumentProcessorService": "Document processing pipeline orchestration",
    "ChatService": "Real-time chat functionality with context management",
    "AnalyticsService": "Comprehensive metrics and analytics collection"
}

# Default service configuration
DEFAULT_SERVICE_CONFIG = {
    "environment": "production",
    "debug": False,
    "max_retries": 3,
    "timeout": 30,
    "batch_size": 32
}

# Type hints for enhanced IDE support
from typing import Dict, Type, Any
ServiceType = Type[Any]
ServiceConfig = Dict[str, Any]