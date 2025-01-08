"""
Test services initialization module configuring comprehensive test suites for backend services.
Implements pytest configuration for test discovery, async testing support, coverage reporting,
and test isolation while maintaining security contexts.

Version: 1.0.0
"""

# pytest configuration imports
import pytest  # version: ^7.4.0
import pytest_asyncio  # version: ^0.21.0
import pytest_cov  # version: ^4.1.0
import pytest_xdist  # version: ^3.3.1

# Import test suites
from .test_document_processor import *
from .test_ai_service import *
from .test_vector_search import *

# Configure pytest plugins
pytest_plugins = [
    'pytest_asyncio',
    'pytest_cov',
    'pytest_xdist'
]

# Configure async test mode
pytest_async_mode = 'auto'

# Configure coverage reporting
pytest_cov_config = {
    'branch': True,
    'cover_pylib': False,
    'omit': [
        'tests/*',
        'setup.py'
    ],
    'report_missing': 'skip',
    'precision': 2
}

# Configure test parallelization
pytest_xdist_config = {
    'numprocesses': 'auto',
    'maxprocesses': 8
}

def pytest_configure(config):
    """
    Configure pytest settings for test organization and execution.
    
    Args:
        config: pytest configuration object
    """
    # Register test categories
    config.addinivalue_line(
        "markers",
        "unit: Unit tests for isolated component testing"
    )
    config.addinivalue_line(
        "markers", 
        "integration: Integration tests across components"
    )
    config.addinivalue_line(
        "markers",
        "security: Security and access control tests"
    )
    
    # Configure async test support
    config.option.asyncio_mode = pytest_async_mode
    
    # Configure coverage settings
    config.option.cov = True
    config.option.cov_config = pytest_cov_config
    
    # Configure parallel execution
    if not config.option.collectonly:
        config.option.dist = 'loadfile'
        config.option.tx = []
        for _ in range(pytest_xdist_config['maxprocesses']):
            config.option.tx.append('popen')
    
    # Configure test isolation
    config.option.isolated_download = True
    
    # Set up security context
    config._metadata.update({
        'test_environment': 'isolated',
        'security_context': 'test',
        'tenant_isolation': True
    })