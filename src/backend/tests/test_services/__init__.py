"""
Test services initialization module configuring pytest for comprehensive backend service testing.
Implements test discovery, async support, coverage reporting, and security context management.

Version: 1.0.0
"""

# Import test suites
from .test_document_processor import *  # version: ^7.4.0
from .test_ai_service import *  # version: ^7.4.0
from .test_vector_search import *  # version: ^7.4.0

# Configure pytest plugins for enhanced testing capabilities
pytest_plugins = [
    'pytest_asyncio',  # version: ^0.21.0
    'pytest_cov',      # version: ^4.1.0
    'pytest_xdist'     # version: ^3.3.1
]

# Configure async test mode
pytest_async_mode = 'auto'

# Configure coverage settings based on technical requirements
pytest_cov_config = {
    'branch': True,
    'cover_pylib': False,
    'omit': [
        'tests/*',
        'setup.py'
    ],
    'report': {
        'exclude_lines': [
            'pragma: no cover',
            'def __repr__',
            'raise NotImplementedError',
            'if __name__ == .__main__.:',
            'pass'
        ]
    }
}

# Configure parallel test execution
pytest_xdist_config = {
    'numprocesses': 'auto',
    'maxprocesses': 8
}

def pytest_configure(config):
    """
    Configure pytest settings for comprehensive test organization and execution.
    
    Args:
        config: pytest configuration object
    """
    # Configure test categories
    config.addinivalue_line(
        "markers",
        "unit: Unit tests for isolated component testing"
    )
    config.addinivalue_line(
        "markers", 
        "integration: Integration tests for component interaction testing"
    )
    config.addinivalue_line(
        "markers",
        "security: Security tests for vulnerability and dependency scanning"
    )
    
    # Configure async test support
    config.option.asyncio_mode = pytest_async_mode
    
    # Configure coverage reporting
    config.option.cov = True
    config.option.cov_config = pytest_cov_config
    config.option.cov_report = {
        'term-missing': True,
        'html': 'coverage_html'
    }
    
    # Configure parallel test execution
    if not config.option.collectonly:
        config.option.dist = 'loadfile'
        config.option.tx = f"8*popen//python=python3"
    
    # Configure test isolation
    config.option.strict = True
    config.option.strict_markers = True
    
    # Configure security context
    config.option.sensitive_url = '.*'
    config.option.sensitive_post = True
    config.option.sensitive_cookies = True