"""Core services module for the AI-powered Product Catalog Search System.

This module provides a centralized interface for accessing all service functionality
including document processing, AI operations, vector search, caching, authentication,
and analytics. Services are initialized in dependency order and support comprehensive
type hints for enhanced IDE support.

Version: 1.0.0
Author: AI-Powered Product Catalog Search System Team"""

from .ocr_service import OCRService
from .ai_service import AIService
from .vector_search import VectorSearchService
from .cache_service import CacheService
from .auth import AuthService
from .document_processor import DocumentProcessor
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
    "DocumentProcessor",
    "ChatService", 
    "AnalyticsService"
]

# Service initialization order is important for dependency management:
# 1. CacheService - Required by most other services
# 2. AuthService - Required for security and access control
# 3. OCRService - Base document processing
# 4. AIService - Depends on vector search
# 5. VectorSearchService - Depends on cache
# 6. DocumentProcessor - Depends on OCR, AI and vector search
# 7. ChatService - Depends on AI and vector search
# 8. AnalyticsService - Depends on all other services

# Note: Actual service instantiation should be handled by the dependency injection
# container to ensure proper initialization order and configuration