"""
Test utilities package initialization and configuration module.
Provides comprehensive test setup for security, validation, and vector processing utilities.

Version: 1.0.0
"""

import pytest  # pytest ^7.4.0

# Define test markers for different test categories
TEST_MARKERS = [
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
        config: pytest.Config object for test configuration

    Returns:
        None - Configuration is applied directly to pytest environment
    """
    # Register custom markers with descriptions
    for marker in TEST_MARKERS:
        config.addinivalue_line(
            "markers",
            f"{marker}: mark test as {marker} test"
        )

    # Configure test logging
    config.option.log_level = "INFO"
    config.option.log_format = (
        "%(asctime)s [%(levelname)8s] %(name)s: "
        "%(message)s (%(filename)s:%(lineno)s)"
    )
    config.option.log_date_format = "%Y-%m-%d %H:%M:%S"

    # Set coverage configuration
    config.option.cov_report = {
        'html': 'coverage_html',
        'xml': 'coverage.xml',
        'term-missing': True
    }
    config.option.cov_fail_under = 85.0  # Minimum coverage threshold

    # Configure test isolation and cleanup
    config.option.isolated_download = True
    config.option.cache_dir = ".pytest_cache"
    config.option.tmp_path_retention_count = 3
    config.option.tmp_path_retention_policy = "always"

    # Set parallel execution configuration
    config.option.numprocesses = "auto"
    config.option.dist = "loadfile"
    
    # Configure security test settings
    config.option.strict = True
    config.option.durations = 10
    config.option.durations_min = 1.0
    config.option.verbosity = 2
    
    # Set up vector processing test configurations
    config.option.embedding_dim = 1536
    config.option.similarity_threshold = 0.8
    config.option.context_window = 8192
    config.option.batch_size = 32

    # Configure mock behavior
    config.option.mock_use_standalone_module = True
    config.option.mock_traceback_filter = True
    
    # Set test collection and execution options
    config.option.testpaths = ["tests"]
    config.option.python_classes = ["Test*"]
    config.option.python_functions = ["test_*"]
    config.option.python_files = ["test_*.py"]
    
    # Configure warning handling
    config.option.filterwarnings = [
        "error",
        "ignore::DeprecationWarning",
        "ignore::UserWarning",
        "ignore::pytest.PytestUnknownMarkWarning"
    ]