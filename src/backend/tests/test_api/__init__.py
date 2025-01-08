"""
Package initialization module for API test suite with enhanced security testing capabilities.
Configures test markers, imports, and shared test utilities for testing REST API endpoints.

Version: 1.0.0
"""

import pytest
from ..conftest import pytest_configure

# API test markers with security testing categories
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
        config: Pytest config object
        
    Returns:
        None
    """
    # Register auth test marker
    config.addinivalue_line(
        "markers",
        "auth: Authentication and authorization test cases including JWT validation, token security, and access control"
    )

    # Register clients test marker
    config.addinivalue_line(
        "markers",
        "clients: Client management test cases including multi-tenant data isolation and access controls"
    )

    # Register documents test marker
    config.addinivalue_line(
        "markers",
        "documents: Document processing test cases including secure storage and access validation"
    )

    # Register queries test marker
    config.addinivalue_line(
        "markers",
        "queries: Search query test cases including input validation and response security"
    )

    # Register analytics test marker
    config.addinivalue_line(
        "markers",
        "analytics: Analytics endpoint test cases including data privacy and access control"
    )

    # Register security test marker
    config.addinivalue_line(
        "markers",
        "security: Comprehensive security test cases including OWASP Top 10 vulnerabilities"
    )

    # Register penetration test marker
    config.addinivalue_line(
        "markers",
        "penetration: API penetration test cases including injection attacks and security misconfigurations"
    )

    # Register vulnerability test marker
    config.addinivalue_line(
        "markers",
        "vulnerability: Vulnerability assessment test cases including security scanning and dependency checks"
    )

    # Register performance test marker
    config.addinivalue_line(
        "markers",
        "performance: API performance test cases including rate limiting and DDoS protection"
    )

    # Register isolation test marker
    config.addinivalue_line(
        "markers",
        "isolation: Multi-tenant isolation test cases including data segregation and access boundary validation"
    )

    # Configure marker dependencies
    config.addinivalue_line(
        "markers",
        "security_dependencies: Marks tests that depend on security infrastructure"
    )

    # Configure test isolation
    config.addinivalue_line(
        "markers",
        "isolated: Marks tests that require complete isolation"
    )

    # Configure security test utilities
    config.addinivalue_line(
        "markers",
        "security_utils: Marks tests that use security testing utilities"
    )

    # Configure test data security
    config.addinivalue_line(
        "markers",
        "secure_data: Marks tests that handle sensitive test data"
    )