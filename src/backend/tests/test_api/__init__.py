"""
Package initialization file for the API test suite that configures test markers,
imports, and shared test utilities for testing the REST API endpoints of the
AI-powered Product Catalog Search System with enhanced security testing capabilities.

Version: 1.0.0
"""

from ..conftest import pytest_configure
import pytest  # version: 7.4.0

# Define API test markers with enhanced security testing support
API_TEST_MARKERS = [
    "auth",         # Authentication and authorization tests
    "clients",      # Client management and multi-tenant tests
    "documents",    # Document processing and storage tests
    "queries",      # Search query and response tests
    "analytics",    # Analytics endpoint tests
    "security",     # Comprehensive security testing
    "penetration",  # API penetration testing
    "vulnerability", # Vulnerability assessment
    "performance",  # API performance testing
    "isolation"     # Multi-tenant isolation testing
]

def configure_api_test_markers(config):
    """
    Configures pytest markers specific to API test categories with enhanced security testing support.
    
    Args:
        config: Pytest configuration object
        
    Returns:
        None
    """
    # Register core API test markers
    config.addinivalue_line("markers", 
        "auth: Authentication and authorization test cases including token validation, "
        "session management, and access control"
    )
    
    config.addinivalue_line("markers",
        "clients: Client management test cases including multi-tenant operations, "
        "client data isolation, and access permissions"
    )
    
    config.addinivalue_line("markers",
        "documents: Document processing test cases including upload, OCR, "
        "vector storage, and retrieval operations"
    )
    
    config.addinivalue_line("markers",
        "queries: Search query test cases including vector similarity search, "
        "context retrieval, and response generation"
    )
    
    config.addinivalue_line("markers",
        "analytics: Analytics endpoint test cases including usage tracking, "
        "performance metrics, and reporting"
    )
    
    # Register security-specific test markers
    config.addinivalue_line("markers",
        "security: Comprehensive security test cases including input validation, "
        "output encoding, and security headers"
    )
    
    config.addinivalue_line("markers",
        "penetration: API penetration test cases including injection attacks, "
        "authentication bypass, and privilege escalation"
    )
    
    config.addinivalue_line("markers",
        "vulnerability: Vulnerability assessment test cases including security "
        "misconfigurations, exposed endpoints, and known CVEs"
    )
    
    config.addinivalue_line("markers",
        "performance: API performance test cases including rate limiting, "
        "resource utilization, and response times"
    )
    
    config.addinivalue_line("markers",
        "isolation: Multi-tenant isolation test cases including data segregation, "
        "access control, and cross-tenant protection"
    )
    
    # Configure marker dependencies and relationships
    config.addinivalue_line("markers",
        "security_dependency: mark test as dependent on security marker"
    )
    
    # Set up security test utilities and helpers
    config.addinivalue_line("markers",
        "security_level: specify security test severity level"
    )
    
    # Initialize test isolation mechanisms
    config.addinivalue_line("markers",
        "tenant_isolation: mark test for tenant isolation verification"
    )
    
    # Configure test data security handling
    config.addinivalue_line("markers",
        "sensitive_data: mark test as handling sensitive data"
    )