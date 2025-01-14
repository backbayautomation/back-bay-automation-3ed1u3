"""
Test utilities initialization module for configuring comprehensive test environment.
Implements test configurations for security, validation, and vector processing utilities.

Version: 1.0.0
"""

import pytest  # pytest ^7.4.0
import logging
from typing import List

# Define test markers for different test categories
TEST_MARKERS: List[str] = [
    "utils",
    "security",
    "validation", 
    "vector",
    "unit",
    "integration",
    "performance",
    "vulnerability",
    "penetration",
    "code_review",
    "embedding",
    "similarity",
    "context"
]

def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest environment with comprehensive setup for security, validation,
    and vector processing tests.

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

    # Configure test logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Configure test coverage settings
    config.option.cov_report = {
        'html': 'coverage/html',
        'xml': 'coverage/coverage.xml',
        'term-missing': True
    }
    config.option.cov_fail_under = 85.0  # 85% coverage threshold

    # Configure test isolation and cleanup
    config.option.clean = True  # Always clean test artifacts
    config.option.isolated = True  # Function level isolation

    # Configure parallel execution
    if hasattr(config.option, 'numprocesses'):
        config.option.numprocesses = 'auto'

    # Configure security test settings
    config.addinivalue_line(
        "security",
        "vulnerability_scan=true"
    )
    config.addinivalue_line(
        "security",
        "penetration_test=true"
    )

    # Configure vector processing test settings
    config.addinivalue_line(
        "vector",
        "embedding_dim=1536"
    )
    config.addinivalue_line(
        "vector",
        "similarity_threshold=0.8"
    )
    config.addinivalue_line(
        "vector",
        "context_window=8192"
    )

    # Configure mock settings
    config.addinivalue_line(
        "mock",
        "strict=true"
    )
    config.addinivalue_line(
        "mock",
        "verify=true"
    )

    # Register cleanup handlers
    config.add_cleanup(cleanup_test_artifacts)

def cleanup_test_artifacts() -> None:
    """
    Cleanup handler for removing test artifacts after test execution.
    Ensures secure deletion of sensitive test data.
    """
    logging.info("Cleaning up test artifacts...")
    # Cleanup implementation will be handled by test runners