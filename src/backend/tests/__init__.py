"""
Backend Test Suite Configuration Module

This module configures comprehensive test settings for the AI-powered Product Catalog Search System,
implementing secure test isolation, coverage tracking, and environment-specific configurations.

Version: 1.0.0
"""

import pytest
from .test_utils import pytest_configure

# Define test markers for different test categories
TEST_MARKERS = [
    "api",          # API endpoint tests
    "services",     # Backend service tests
    "utils",        # Utility function tests
    "security",     # Security and vulnerability tests
    "integration",  # Integration tests
    "unit"         # Unit tests
]

def pytest_configure(config: pytest.Config) -> None:
    """
    Configures pytest settings and markers for the entire backend test suite.
    Implements comprehensive test configuration including security, coverage,
    and environment-specific setups.

    Args:
        config (pytest.Config): Pytest configuration object

    Returns:
        None: Configuration is applied directly to pytest environment
    """
    # Register custom markers with descriptions
    for marker in TEST_MARKERS:
        config.addinivalue_line(
            "markers",
            f"{marker}: mark test as {marker} test"
        )

    # Configure test coverage settings with 85% threshold requirement
    config.option.cov_report = {
        'html': 'coverage/html',
        'xml': 'coverage/coverage.xml',
        'term-missing': True
    }
    config.option.cov_fail_under = 85.0

    # Configure security test settings
    config.addinivalue_line(
        "security",
        "vulnerability_scan=true"
    )
    config.addinivalue_line(
        "security",
        "penetration_test=true"
    )

    # Configure test isolation and database settings
    config.option.isolated_download = True
    config.option.clean = "always"

    # Configure mock settings for external services
    config.addinivalue_line(
        "mock",
        "gpt4_endpoint=mock"
    )
    config.addinivalue_line(
        "mock",
        "nvidia_ocr=mock"
    )

    # Set up test data handling with secure isolation
    config.addinivalue_line(
        "testdata",
        "secure_cleanup=true"
    )
    config.addinivalue_line(
        "testdata",
        "isolation_level=function"
    )

    # Configure parallel test execution
    if not hasattr(config.option, 'numprocesses'):
        config.option.numprocesses = 'auto'

    # Configure test reporting
    config.option.verbose = 2
    config.option.showlocals = True
    config.option.tb = "short"

    # Import and apply additional test configurations from test_utils
    pytest_configure(config)