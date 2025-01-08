"""
Backend Test Suite Configuration Module
Configures comprehensive test settings, fixtures, and markers for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

import pytest  # pytest ^7.4.0
from .test_utils import pytest_configure as utils_configure

# Define test markers for different test categories
TEST_MARKERS = [
    "api",           # API endpoint tests
    "services",      # Backend service tests
    "utils",         # Utility function tests
    "security",      # Security and vulnerability tests
    "integration",   # Integration tests
    "unit"          # Unit tests
]

def pytest_configure(config: pytest.Config) -> None:
    """
    Configures pytest settings and markers for the entire backend test suite including
    security configurations, coverage settings, and environment-specific setups.

    Args:
        config: pytest.Config object for test configuration

    Returns:
        None - Configuration is applied directly to pytest environment
    """
    # Initialize base test utilities configuration
    utils_configure(config)

    # Register backend-specific test markers
    for marker in TEST_MARKERS:
        config.addinivalue_line(
            "markers",
            f"{marker}: mark test as {marker} test"
        )

    # Configure test collection paths
    config.option.testpaths = [
        "tests/api",          # API tests
        "tests/services",     # Service tests
        "tests/security",     # Security tests
        "tests/integration"   # Integration tests
    ]

    # Set backend-specific test patterns
    config.option.python_classes = [
        "TestAPI*",
        "TestService*",
        "TestSecurity*",
        "TestIntegration*"
    ]

    # Configure test isolation and security
    config.option.strict_markers = True
    config.option.strict_config = True
    config.option.capture = "sys"  # Capture stdout/stderr

    # Set up backend service mocks
    config.option.mock_configs = {
        "gpt4": {
            "response_time": 2.0,
            "token_limit": 8192,
            "temperature": 0.7
        },
        "nvidia_ocr": {
            "dpi": 300,
            "batch_size": 32,
            "gpu_memory": "2GB"
        },
        "vector_store": {
            "dimension": 1536,
            "similarity_threshold": 0.8,
            "index_type": "HNSW"
        }
    }

    # Configure coverage settings
    config.option.cov_config = ".coveragerc"
    config.option.cov_branch = True
    config.option.cov_fail_under = 85.0

    # Set up security test configurations
    config.option.security = {
        "sast": {
            "enabled": True,
            "fail_on": ["CRITICAL", "HIGH"],
            "tools": ["bandit", "safety"]
        },
        "dast": {
            "enabled": True,
            "endpoints": ["api", "services"],
            "tools": ["zap-baseline"]
        }
    }

    # Configure test database settings
    config.option.test_db = {
        "isolation_level": "SERIALIZABLE",
        "pool_size": 5,
        "max_overflow": 10,
        "echo": False
    }

    # Set up environment-specific configurations
    config.option.env_configs = {
        "test": {
            "log_level": "DEBUG",
            "async_mode": True,
            "timeout": 30
        },
        "ci": {
            "log_level": "INFO",
            "async_mode": True,
            "timeout": 60
        }
    }

    # Configure parallel test execution
    config.option.numprocesses = "auto"
    config.option.dist = "loadscope"

    # Set up logging configuration
    config.option.log_cli = True
    config.option.log_cli_level = "INFO"
    config.option.log_cli_format = (
        "%(asctime)s [%(levelname)8s] %(name)s: "
        "%(message)s (%(filename)s:%(lineno)s)"
    )
    config.option.log_cli_date_format = "%Y-%m-%d %H:%M:%S"

    # Configure warning handling
    config.option.filterwarnings = [
        "error",
        "ignore::DeprecationWarning",
        "ignore::UserWarning",
        "ignore::pytest.PytestUnknownMarkWarning"
    ]