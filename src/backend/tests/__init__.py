"""
Backend test suite initialization module for the AI-powered Product Catalog Search System.
Configures comprehensive test settings including security, API, and service tests.

Version: 1.0.0
"""

import pytest  # pytest ^7.4.0
from .test_utils import pytest_configure as utils_configure

# Define test markers for backend components
TEST_MARKERS = [
    "api",           # API endpoint tests
    "services",      # Backend service tests
    "utils",         # Utility function tests
    "security",      # Security and authentication tests
    "integration",   # Integration tests
    "unit"          # Unit tests
]

def pytest_configure(config: pytest.Config) -> None:
    """
    Configures pytest settings and markers for the entire backend test suite.
    Implements comprehensive test configuration including security, coverage,
    and environment-specific settings.

    Args:
        config (pytest.Config): Pytest configuration object

    Returns:
        None: Configuration is applied directly to pytest environment
    """
    # First apply base utility configurations
    utils_configure(config)

    # Register backend-specific test markers
    for marker in TEST_MARKERS:
        config.addinivalue_line(
            "markers",
            f"{marker}: mark test as {marker} test"
        )

    # Configure backend test coverage settings
    config.option.cov_report = {
        'html': 'coverage/backend/html',
        'xml': 'coverage/backend/coverage.xml',
        'term-missing': True
    }
    config.option.cov_fail_under = 85.0  # Minimum 85% coverage requirement

    # Configure backend service test settings
    config.addinivalue_line(
        "services",
        "document_processor=true"
    )
    config.addinivalue_line(
        "services",
        "ai_engine=true"
    )
    config.addinivalue_line(
        "services",
        "search_index=true"
    )

    # Configure API test settings
    config.addinivalue_line(
        "api",
        "auth_required=true"
    )
    config.addinivalue_line(
        "api",
        "rate_limit=true"
    )

    # Configure mock settings for external services
    config.addinivalue_line(
        "mock",
        "gpt4_endpoint=https://api.openai.com/v1"
    )
    config.addinivalue_line(
        "mock",
        "nvidia_ocr_endpoint=https://api.nvidia.com/ocr/v1"
    )

    # Configure test database settings
    config.addinivalue_line(
        "database",
        "isolation_level=SERIALIZABLE"
    )
    config.addinivalue_line(
        "database",
        "test_schema=test_catalog_search"
    )

    # Configure test environment settings
    config.addinivalue_line(
        "env",
        "azure_region=test"
    )
    config.addinivalue_line(
        "env",
        "deployment_stage=test"
    )

    # Configure security scan integration
    config.addinivalue_line(
        "security",
        "sast_enabled=true"
    )
    config.addinivalue_line(
        "security",
        "dast_enabled=true"
    )

    # Configure parallel test execution
    if hasattr(config.option, 'numprocesses'):
        config.option.numprocesses = 'auto'

    # Enable test isolation
    config.option.isolated = True