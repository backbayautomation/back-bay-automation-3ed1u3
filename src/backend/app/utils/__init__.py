"""
Main entry point for the utils package, exposing commonly used utility functions
for security, validation, document processing, and vector operations.

Version: 1.0.0
"""

# Import security utilities
from .security import (
    validate_input,
    mask_sensitive_data,
    generate_secure_token
)

# Import validation utilities
from .validators import (
    validate_email,
    validate_password,
    validate_document_type
)

# Import document processing utilities
from .document_utils import (
    validate_file_type,
    prepare_for_ocr
)

# Import vector operation utilities
from .vector_utils import (
    calculate_cosine_similarity,
    batch_similarity_search
)

# Define package exports
__all__ = [
    # Security utilities
    'validate_input',
    'mask_sensitive_data',
    'generate_secure_token',
    
    # Validation utilities
    'validate_email',
    'validate_password',
    'validate_document_type',
    
    # Document processing utilities
    'validate_file_type',
    'prepare_for_ocr',
    
    # Vector operation utilities
    'calculate_cosine_similarity',
    'batch_similarity_search'
]

# Package metadata
__version__ = '1.0.0'
__author__ = 'AI-Powered Product Catalog Search System Team'
__description__ = '''
Comprehensive utility package providing enterprise-grade functions for:
- Security and input validation
- Document processing and OCR preparation
- Vector operations and similarity search
- Data masking and protection
'''