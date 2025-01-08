"""
Package initialization file for the API test suite that configures test markers,
imports, and shared test utilities for testing the REST API endpoints of the
AI-powered Product Catalog Search System with enhanced security testing capabilities.

Version: 1.0.0
"""

import pytest  # version: 7.4.0
from ..conftest import pytest_configure

# Define API test markers with enhanced security testing support
API_TEST_MARKERS = [
    "auth",          # Authentication and authorization tests
    "clients",       # Client management and multi-tenant tests
    "documents",     # Document processing and storage tests
    "queries",       # Search query and response tests
    "analytics",     # Analytics endpoint tests
    "security",      # Comprehensive security testing
    "penetration",   # API penetration testing
    "vulnerability", # Vulnerability assessment
    "performance",   # API performance testing
    "isolation"      # Multi-tenant isolation testing
]

def configure_api_test_markers(config):
    """
    Configures pytest markers specific to API test categories with enhanced security testing support.
    
    Args:
        config: Pytest configuration object
        
    Returns:
        None
    """
    # Register auth test marker for authentication and authorization tests
    config.addinivalue_line(
        "markers",
        "auth: Tests for authentication, authorization, and token management"
    )

    # Register clients test marker for client management and multi-tenant tests
    config.addinivalue_line(
        "markers",
        "clients: Tests for client CRUD operations and tenant isolation"
    )

    # Register documents test marker for document processing tests
    config.addinivalue_line(
        "markers",
        "documents: Tests for document upload, processing, and retrieval"
    )

    # Register queries test marker for search query tests
    config.addinivalue_line(
        "markers",
        "queries: Tests for search query processing and response handling"
    )

    # Register analytics test marker for analytics endpoint tests
    config.addinivalue_line(
        "markers",
        "analytics: Tests for analytics data collection and reporting"
    )

    # Register security test marker for comprehensive security testing
    config.addinivalue_line(
        "markers",
        "security: Comprehensive security tests including auth, encryption, and access control"
    )

    # Register penetration test marker for API penetration testing
    config.addinivalue_line(
        "markers",
        "penetration: API penetration tests for security vulnerabilities"
    )

    # Register vulnerability test marker for vulnerability assessment
    config.addinivalue_line(
        "markers",
        "vulnerability: Tests for known security vulnerabilities and patches"
    )

    # Register performance test marker for API performance testing
    config.addinivalue_line(
        "markers",
        "performance: API performance and load testing scenarios"
    )

    # Register isolation test marker for multi-tenant isolation testing
    config.addinivalue_line(
        "markers",
        "isolation: Tests for proper multi-tenant data isolation"
    )

    # Configure marker dependencies and relationships
    config.addinivalue_line(
        "markers",
        "security_dependencies: security tests that depend on other test categories"
    )

    # Set up security test utilities and helpers
    config.addinivalue_line(
        "markers",
        "security_utils: utility functions for security testing"
    )

    # Initialize test isolation mechanisms
    config.addinivalue_line(
        "markers",
        "isolation_setup: setup functions for tenant isolation testing"
    )

    # Configure test data security handling
    config.addinivalue_line(
        "markers",
        "secure_data: tests involving secure data handling"
    )

# Export API test markers and configuration function
__all__ = [
    "API_TEST_MARKERS",
    "configure_api_test_markers"
]