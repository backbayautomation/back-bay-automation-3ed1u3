"""
Comprehensive test suite for the DocumentProcessor service validating document ingestion,
OCR processing, text chunking, embedding generation, and vector indexing functionality.

Version: 1.0.0
"""

import pytest
import pytest_asyncio
import numpy as np
import time
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime

from app.services.document_processor import DocumentProcessor
from app.models.document import Document, DocumentStatus
from app.utils.document_utils import validate_file_type, prepare_for_ocr

# Test constants based on technical specifications
TEST_CHUNK_SIZE = 1000
TEST_CHUNK_OVERLAP = 100
TEST_EMBEDDING_DIM = 1536
TEST_BATCH_SIZE = 32
OCR_ACCURACY_THRESHOLD = 0.95
LAYOUT_PRESERVATION_THRESHOLD = 0.9
PROCESSING_TIME_LIMIT = 2.0
MAX_RETRIES = 3

@pytest.fixture
def mock_ocr_service():
    """Fixture providing configurable OCR service mock with performance metrics."""
    mock_service = AsyncMock()
    
    async def process_document(document):
        # Simulate OCR processing with configurable accuracy
        processing_time = 1.5  # seconds per page
        accuracy = 0.96  # 96% accuracy
        
        result = {
            'text': 'Sample processed text with high accuracy',
            'confidence': accuracy,
            'processing_metrics': {
                'time_per_page': processing_time,
                'accuracy': accuracy,
                'layout_preservation': 0.92
            }
        }
        return result
    
    mock_service.process_document = process_document
    return mock_service

@pytest.fixture
def mock_ai_service():
    """Fixture providing AI service mock for embedding generation."""
    mock_service = AsyncMock()
    
    async def generate_embeddings(text, metadata):
        # Generate mock embeddings with correct dimensionality
        embedding = np.random.randn(TEST_EMBEDDING_DIM).astype(np.float32)
        embedding /= np.linalg.norm(embedding)
        return embedding
    
    mock_service.generate_embeddings = generate_embeddings
    return mock_service

@pytest.fixture
def mock_vector_search():
    """Fixture providing vector search service mock."""
    mock_service = AsyncMock()
    
    async def batch_index(embeddings, tenant_id):
        return {'indexed_count': len(embeddings)}
    
    mock_service.batch_index = batch_index
    return mock_service

@pytest.fixture
async def document_processor(mock_ocr_service, mock_ai_service, mock_vector_search):
    """Fixture providing configured DocumentProcessor instance."""
    config = {
        'chunk_size': TEST_CHUNK_SIZE,
        'chunk_overlap': TEST_CHUNK_OVERLAP,
        'batch_size': TEST_BATCH_SIZE,
        'max_retries': MAX_RETRIES
    }
    
    processor = DocumentProcessor(
        ocr_service=mock_ocr_service,
        ai_service=mock_ai_service,
        vector_search=mock_vector_search,
        config=config
    )
    return processor

@pytest.mark.asyncio
async def test_process_document_success(document_processor):
    """
    Test successful document processing through complete pipeline with performance validation.
    Verifies OCR accuracy, chunking, embedding generation, and vector indexing.
    """
    # Create test document
    document = Document(
        client_id='test-client',
        filename='test.pdf',
        type='pdf',
        metadata={'page_count': 1}
    )
    
    # Process start time
    start_time = time.time()
    
    # Process document
    result = await document_processor.process_document(document, 'test-tenant')
    
    # Calculate processing time
    processing_time = time.time() - start_time
    
    # Verify document status
    assert document.status == DocumentStatus.COMPLETED.value
    
    # Verify processing time within SLA
    assert processing_time < PROCESSING_TIME_LIMIT * document.metadata['page_count']
    
    # Verify OCR metrics
    ocr_metrics = document.metadata.get('processing', {}).get('ocr_metrics', {})
    assert ocr_metrics.get('accuracy', 0) >= OCR_ACCURACY_THRESHOLD
    assert ocr_metrics.get('layout_preservation', 0) >= LAYOUT_PRESERVATION_THRESHOLD
    
    # Verify chunking results
    assert len(result.get('chunks_processed', [])) > 0
    
    # Verify embedding generation
    assert result.get('embeddings_generated', 0) > 0
    
    # Verify vector indexing
    assert result.get('status') == 'success'

@pytest.mark.asyncio
async def test_process_document_with_retries(document_processor, mock_ocr_service):
    """
    Test document processing with transient failures and retry mechanism.
    Validates error handling and recovery capabilities.
    """
    # Configure OCR service to fail initially
    fail_count = [0]
    
    async def mock_process_with_retries(*args, **kwargs):
        fail_count[0] += 1
        if fail_count[0] <= 2:  # Fail twice
            raise Exception("Temporary OCR failure")
        return await mock_ocr_service.process_document(*args, **kwargs)
    
    document_processor._ocr_service.process_document = mock_process_with_retries
    
    # Create test document
    document = Document(
        client_id='test-client',
        filename='test.pdf',
        type='pdf'
    )
    
    # Process document
    result = await document_processor.process_document(document, 'test-tenant')
    
    # Verify retry behavior
    assert fail_count[0] == 3  # Two failures + one success
    assert document.status == DocumentStatus.COMPLETED.value
    assert result['status'] == 'success'
    
    # Verify retry metrics
    assert document.metadata.get('processing', {}).get('retry_count') == 2

@pytest.mark.asyncio
async def test_chunk_text_with_layout_preservation(document_processor):
    """
    Test text chunking with layout preservation and overlap validation.
    Verifies chunk size, overlap, and metadata generation.
    """
    # Test content with layout elements
    test_content = """
    Section 1: Introduction
    This is a test paragraph with important layout.
    
    Section 2: Details
    - Bullet point 1
    - Bullet point 2
    
    Table:
    | Column 1 | Column 2 |
    |----------|----------|
    | Data 1   | Data 2   |
    """
    
    # Process chunks
    chunks = await document_processor.chunk_text(
        test_content,
        preserve_layout=True
    )
    
    # Verify chunk properties
    for chunk in chunks:
        # Verify chunk size
        assert len(chunk['content']) <= TEST_CHUNK_SIZE
        
        # Verify metadata
        assert 'sequence' in chunk['metadata']
        assert 'paragraphs' in chunk['metadata']
        assert 'has_overlap' in chunk['metadata']
        
        # Verify layout preservation
        if '|' in chunk['content']:
            # Table structure should be preserved
            table_lines = [line for line in chunk['content'].split('\n') if '|' in line]
            assert len(table_lines) >= 2  # Header and data rows should stay together

@pytest.mark.asyncio
async def test_process_chunks_batch_optimization(document_processor):
    """
    Test batch processing of chunks with performance optimization.
    Validates batch size, embedding generation, and error handling.
    """
    # Create test chunks
    test_chunks = [
        {'content': f'Test content {i}', 'sequence': i}
        for i in range(TEST_BATCH_SIZE + 5)  # Create more than one batch
    ]
    
    # Process chunks
    embeddings = await document_processor._process_chunks(test_chunks, 'test-tenant')
    
    # Verify embedding properties
    assert len(embeddings) == len(test_chunks)
    for embedding in embeddings:
        assert embedding.shape[0] == TEST_EMBEDDING_DIM
        assert abs(np.linalg.norm(embedding) - 1.0) < 1e-6  # Verify normalization

@pytest.mark.asyncio
async def test_validate_ocr_output(document_processor):
    """
    Test OCR output validation with quality metrics.
    Verifies accuracy thresholds and error detection.
    """
    # Test OCR output
    ocr_output = {
        'text': 'Sample OCR output',
        'confidence': 0.96,
        'layout_preservation': 0.92,
        'processing_metrics': {
            'time_per_page': 1.5,
            'error_rate': 0.04
        }
    }
    
    # Validate output
    validation_result = await document_processor.validate_ocr_output(ocr_output)
    
    # Verify validation metrics
    assert validation_result['accuracy'] >= OCR_ACCURACY_THRESHOLD
    assert validation_result['layout_preservation'] >= LAYOUT_PRESERVATION_THRESHOLD
    assert validation_result['processing_time'] <= PROCESSING_TIME_LIMIT