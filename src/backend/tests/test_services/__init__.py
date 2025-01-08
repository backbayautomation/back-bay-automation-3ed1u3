"""
Test services initialization module configuring comprehensive test suites for backend services
including document processing, AI services, vector search, and security testing.

Version: 1.0.0
"""

import pytest  # version: 7.4.0
import pytest_asyncio  # version: 0.21.0
import pytest_cov  # version: 4.1.0
import pytest_xdist  # version: 3.3.1
import logging
from typing import Dict, Any

# Import test suites
from .test_document_processor import *
from .test_ai_service import *
from .test_vector_search import *

# Configure test plugins
pytest_plugins = [
    'pytest_asyncio',
    'pytest_cov',
    'pytest_xdist'
]

# Configure async test mode
pytest_async_mode = 'auto'

# Configure coverage settings
pytest_cov_config = {
    'branch': True,
    'cover_pylib': False,
    'omit': [
        'tests/*',
        'setup.py'
    ],
    'report_options': {
        'exclude_lines': [
            'pragma: no cover',
            'def __repr__',
            'raise NotImplementedError'
        ]
    }
}

# Configure parallel test execution
pytest_xdist_config = {
    'numprocesses': 'auto',
    'maxprocesses': 8
}

def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest settings for comprehensive test organization and execution.
    
    Args:
        config: Pytest configuration object
    """
    # Configure test categories
    config.addinivalue_line(
        "markers",
        "unit: Unit tests for individual components"
    )
    config.addinivalue_line(
        "markers", 
        "integration: Integration tests across components"
    )
    config.addinivalue_line(
        "markers",
        "security: Security and vulnerability tests"
    )
    
    # Configure async test support
    config.option.asyncio_mode = pytest_async_mode
    
    # Configure coverage reporting
    config.option.cov_config = pytest_cov_config
    config.option.cov_branch = True
    config.option.cov_report = ['term-missing', 'html', 'xml']
    
    # Configure parallel execution
    if not config.option.collectonly:
        config.option.dist = 'loadfile'
        config.option.tx = f'8*popen//python={config.option.python_executable}'
    
    # Configure test isolation
    config.option.isolated_build = True
    
    # Set up logging for tests
    logging.basicConfig(
        level=logging.DEBUG if config.option.verbose > 0 else logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[logging.StreamHandler()]
    )
    
    # Configure security context
    config.option.sensitive_url = None
    config.option.sensitive_post = None
    config.option.sensitive_files = []