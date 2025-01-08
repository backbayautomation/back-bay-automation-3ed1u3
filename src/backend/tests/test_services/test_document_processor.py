"""
Comprehensive test suite for the DocumentProcessor service validating document processing pipeline.
Tests document ingestion, OCR processing, text chunking, embedding generation, and vector indexing.

Version: 1.0.0
"""

import pytest
import pytest_asyncio
import numpy as np
import time
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
from uuid import uuid4

from app.services.document_processor import DocumentProcessor
from app.models.document import Document, DocumentStatus
from app.models.chunk import Chunk

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
        chunks = []
        processing_time = 1.5  # Simulated processing time
        
        # Generate test chunks with metadata
        for i in range(3):
            chunk = Mock(spec=Chunk)
            chunk.content = f"Test content {i}"
            chunk.metadata = {
                'ocr_confidence': 0.96,  # Above threshold
                'layout_preservation': 0.92,
                'processing_time': processing_time,
                'page_number': i + 1
            }
            chunks.append(chunk)
        
        return chunks
    
    mock_service.process_document = process_document
    return mock_service

@pytest.fixture
def mock_ai_service():
    """Fixture providing AI service mock for embedding generation."""
    mock_service = AsyncMock()
    
    async def generate_embeddings(text, metadata):
        # Generate test embeddings with correct dimensions
        return np.random.randn(TEST_EMBEDDING_DIM).astype(np.float32)
    
    mock_service.generate_embeddings = generate_embeddings
    return mock_service

@pytest.fixture
def mock_vector_search():
    """Fixture providing vector search service mock."""
    mock_service = AsyncMock()
    
    async def batch_index(embeddings, tenant_id):
        return True
    
    mock_service.batch_index = batch_index
    return mock_service

@pytest_asyncio.fixture
async def document_processor(mock_ocr_service, mock_ai_service, mock_vector_search):
    """Fixture providing configured DocumentProcessor instance."""
    config = {
        'chunk_size': TEST_CHUNK_SIZE,
        'chunk_overlap': TEST_CHUNK_OVERLAP,
        'batch_size': TEST_BATCH_SIZE
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
    Verifies OCR accuracy, layout preservation, and processing time requirements.
    """
    # Create test document
    document = Mock(spec=Document)
    document.id = uuid4()
    document.filename = "test.pdf"
    document.type = "pdf"
    document.status = DocumentStatus.PENDING
    document.update_status = AsyncMock()
    document.update_metadata = AsyncMock()
    
    # Process document
    start_time = time.time()
    result = await document_processor.process_document(document, "test_tenant")
    processing_time = time.time() - start_time
    
    # Verify document status updates
    document.update_status.assert_any_await("processing")
    document.update_status.assert_any_await("completed")
    
    # Verify processing time meets SLA
    assert processing_time < PROCESSING_TIME_LIMIT, f"Processing time {processing_time}s exceeds SLA of {PROCESSING_TIME_LIMIT}s"
    
    # Verify OCR quality metrics
    metadata_calls = document.update_metadata.call_args_list
    final_metadata = metadata_calls[-1].args[0]
    assert final_metadata['ocr_quality'] > OCR_ACCURACY_THRESHOLD, \
        f"OCR quality {final_metadata['ocr_quality']} below threshold {OCR_ACCURACY_THRESHOLD}"
    
    # Verify result structure
    assert result['status'] == 'completed'
    assert 'document_id' in result
    assert 'chunks_processed' in result
    assert 'embeddings_generated' in result
    assert 'processing_time' in result
    assert 'metrics' in result

@pytest.mark.asyncio
async def test_process_document_with_retries(document_processor):
    """
    Test document processing with transient failures and retry mechanism.
    Validates error handling and recovery capabilities.
    """
    # Configure OCR service to fail initially
    mock_ocr = AsyncMock()
    failure_count = [0]
    
    async def process_with_retries(doc):
        if failure_count[0] < 2:
            failure_count[0] += 1
            raise RuntimeError("Temporary OCR failure")
        return await document_processor._ocr_service.process_document(doc)
    
    mock_ocr.process_document = process_with_retries
    document_processor._ocr_service = mock_ocr
    
    # Create test document
    document = Mock(spec=Document)
    document.id = uuid4()
    document.filename = "test.pdf"
    document.type = "pdf"
    document.status = DocumentStatus.PENDING
    document.update_status = AsyncMock()
    document.update_metadata = AsyncMock()
    
    # Process document
    result = await document_processor.process_document(document, "test_tenant")
    
    # Verify retry behavior
    assert failure_count[0] == 2, "Expected 2 failures before success"
    assert result['status'] == 'completed'
    
    # Verify metadata updates include retry information
    metadata_calls = document.update_metadata.call_args_list
    final_metadata = metadata_calls[-1].args[0]
    assert 'retry_count' in final_metadata
    assert final_metadata['retry_count'] == 2

@pytest.mark.asyncio
async def test_chunk_text_with_layout_preservation(document_processor):
    """
    Test text chunking with layout preservation requirements.
    Validates chunk size, overlap, and layout preservation metrics.
    """
    # Test content with layout elements
    test_content = """
    Section 1: Introduction
    This is a test paragraph with specific layout.
    
    Section 2: Details
    - Bullet point 1
    - Bullet point 2
    
    Table:
    | Column 1 | Column 2 |
    |----------|----------|
    | Data 1   | Data 2   |
    """
    
    # Process chunks
    chunks = await document_processor.chunk_text(test_content, preserve_layout=True)
    
    # Verify chunk properties
    assert len(chunks) > 0, "No chunks generated"
    
    for chunk in chunks:
        # Verify chunk size
        assert len(chunk) <= TEST_CHUNK_SIZE, f"Chunk size {len(chunk)} exceeds limit {TEST_CHUNK_SIZE}"
        
        # Verify layout preservation
        if "Table:" in chunk:
            assert "|" in chunk, "Table formatting lost in chunking"
        if "Section" in chunk:
            assert chunk.index("Section") == chunk.find("Section"), "Section header position changed"

@pytest.mark.asyncio
async def test_process_chunks_batch_optimization(document_processor):
    """
    Test batch processing of chunks with performance optimization.
    Validates embedding generation and batch processing efficiency.
    """
    # Create test chunks
    test_chunks = [f"Test chunk {i}" for i in range(50)]
    
    # Process chunks
    start_time = time.time()
    embeddings = await document_processor.process_chunks(test_chunks, "test_tenant")
    processing_time = time.time() - start_time
    
    # Verify embeddings
    assert len(embeddings) == len(test_chunks), "Not all chunks processed"
    for embedding in embeddings:
        assert embedding.shape[0] == TEST_EMBEDDING_DIM, \
            f"Invalid embedding dimension {embedding.shape[0]}, expected {TEST_EMBEDDING_DIM}"
    
    # Verify batch processing efficiency
    expected_batches = (len(test_chunks) + TEST_BATCH_SIZE - 1) // TEST_BATCH_SIZE
    assert processing_time < expected_batches * 0.5, "Batch processing too slow"

@pytest.mark.asyncio
async def test_process_document_error_handling(document_processor):
    """
    Test error handling and recovery in document processing pipeline.
    Validates error reporting and status updates.
    """
    # Configure services to raise errors
    document_processor._ocr_service.process_document.side_effect = RuntimeError("OCR failed")
    
    # Create test document
    document = Mock(spec=Document)
    document.id = uuid4()
    document.filename = "test.pdf"
    document.type = "pdf"
    document.status = DocumentStatus.PENDING
    document.update_status = AsyncMock()
    document.update_metadata = AsyncMock()
    
    # Process document and expect error
    with pytest.raises(RuntimeError):
        await document_processor.process_document(document, "test_tenant")
    
    # Verify error handling
    document.update_status.assert_any_await("failed")
    metadata_calls = document.update_metadata.call_args_list
    error_metadata = metadata_calls[-1].args[0]
    assert 'error' in error_metadata
    assert 'error_type' in error_metadata
    assert not error_metadata['processing_successful']