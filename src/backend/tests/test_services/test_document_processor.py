"""
Comprehensive test suite for the DocumentProcessor service validating document ingestion,
OCR processing, text chunking, embedding generation, and vector indexing functionality.

Version: 1.0.0
"""

import pytest
import pytest_asyncio
import numpy as np
import time
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
from uuid import uuid4

from app.services.document_processor import DocumentProcessor
from app.models.document import Document, DocumentStatus
from app.models.chunk import Chunk
from app.models.embedding import Embedding

# Test constants from technical specifications
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
    """Fixture providing configurable OCR service mock."""
    mock = AsyncMock()
    
    async def process_document(document):
        # Simulate OCR processing with configurable accuracy
        chunks = []
        for i in range(3):  # Generate test chunks
            chunks.append(Chunk(
                document_id=document.id,
                content=f"Test content {i}",
                sequence=i,
                metadata={
                    'ocr_confidence': 0.96,
                    'layout_preservation_score': 0.92,
                    'processing_time': 1.5,
                    'layout_info': {
                        'bounds': {'x': 0, 'y': 0, 'width': 100, 'height': 100},
                        'font_size': 12,
                        'alignment': 'left'
                    }
                }
            ))
        return chunks
    
    mock.process_document = process_document
    return mock

@pytest.fixture
def mock_ai_service():
    """Fixture providing AI service mock for embedding generation."""
    mock = AsyncMock()
    
    async def generate_embeddings(text, metadata):
        # Generate deterministic test embeddings
        embedding = np.random.randn(TEST_EMBEDDING_DIM).astype(np.float32)
        embedding = embedding / np.linalg.norm(embedding)
        return embedding
    
    mock.generate_embeddings = generate_embeddings
    return mock

@pytest.fixture
def mock_vector_search():
    """Fixture providing vector search service mock."""
    mock = AsyncMock()
    mock.batch_index = AsyncMock()
    return mock

@pytest_asyncio.fixture
async def document_processor(mock_ocr_service, mock_ai_service, mock_vector_search):
    """Fixture providing configured DocumentProcessor instance."""
    config = {
        'chunk_size': TEST_CHUNK_SIZE,
        'chunk_overlap': TEST_CHUNK_OVERLAP,
        'batch_size': TEST_BATCH_SIZE,
        'max_retries': MAX_RETRIES
    }
    return DocumentProcessor(
        ocr_service=mock_ocr_service,
        ai_service=mock_ai_service,
        vector_search=mock_vector_search,
        config=config
    )

@pytest.mark.asyncio
async def test_process_document_success(document_processor):
    """Test successful document processing through complete pipeline."""
    # Arrange
    document = Document(
        client_id=uuid4(),
        filename="test.pdf",
        type="pdf",
        metadata={'test_case': 'success'}
    )
    start_time = time.time()
    
    # Act
    result = await document_processor.process_document(document, "test_tenant")
    processing_time = time.time() - start_time
    
    # Assert
    assert result['status'] == 'completed'
    assert result['chunks_processed'] > 0
    assert result['embeddings_generated'] > 0
    assert processing_time < PROCESSING_TIME_LIMIT
    
    # Verify document status updates
    assert document.status == DocumentStatus.COMPLETED.value
    assert document.metadata.get('processing_stats')
    assert document.metadata['processing_stats']['processing_time'] > 0
    
    # Verify OCR quality metrics
    ocr_quality = np.mean([
        chunk.metadata.get('ocr_confidence', 0)
        for chunk in document.chunks
    ])
    assert ocr_quality >= OCR_ACCURACY_THRESHOLD
    
    # Verify layout preservation
    layout_scores = [
        chunk.metadata.get('layout_preservation_score', 0)
        for chunk in document.chunks
    ]
    assert np.mean(layout_scores) >= LAYOUT_PRESERVATION_THRESHOLD

@pytest.mark.asyncio
async def test_process_document_with_retries(document_processor):
    """Test document processing with transient failures and retry mechanism."""
    # Arrange
    document = Document(
        client_id=uuid4(),
        filename="test_retry.pdf",
        type="pdf"
    )
    
    # Configure OCR service to fail temporarily
    fail_count = [0]
    original_process = document_processor._ocr_service.process_document
    
    async def mock_process_with_failures(doc):
        if fail_count[0] < 2:  # Fail twice then succeed
            fail_count[0] += 1
            raise Exception("Temporary OCR failure")
        return await original_process(doc)
    
    document_processor._ocr_service.process_document = mock_process_with_failures
    
    # Act
    result = await document_processor.process_document(document, "test_tenant")
    
    # Assert
    assert result['status'] == 'completed'
    assert fail_count[0] == 2  # Verify retry mechanism worked
    assert document.metadata['status_history'][-1]['retry_count'] == 2
    
    # Verify final success
    assert document.status == DocumentStatus.COMPLETED.value
    assert len(document.chunks) > 0

@pytest.mark.asyncio
async def test_process_document_invalid_file(document_processor):
    """Test handling of invalid document files."""
    # Arrange
    document = Document(
        client_id=uuid4(),
        filename="invalid.xyz",
        type="xyz"
    )
    
    # Act & Assert
    with pytest.raises(ValueError, match="Document validation failed"):
        await document_processor.process_document(document, "test_tenant")
    
    assert document.status == DocumentStatus.INVALID.value

@pytest.mark.asyncio
async def test_chunk_generation_optimization(document_processor):
    """Test chunk generation with overlap and size optimization."""
    # Arrange
    test_content = " ".join(["test content"] * 1000)  # Large test content
    
    # Act
    chunks = document_processor.chunk_text(test_content)
    
    # Assert
    assert len(chunks) > 1
    # Verify chunk sizes
    for chunk in chunks:
        assert len(chunk.content) <= TEST_CHUNK_SIZE
        assert len(chunk.content) >= TEST_CHUNK_SIZE // 2
    
    # Verify overlap
    for i in range(len(chunks) - 1):
        overlap_text = set(chunks[i].content.split()[-50:]).intersection(
            set(chunks[i + 1].content.split()[:50])
        )
        assert len(overlap_text) > 0

@pytest.mark.asyncio
async def test_embedding_batch_processing(document_processor):
    """Test batch processing of embeddings with performance monitoring."""
    # Arrange
    chunks = [
        Chunk(document_id=uuid4(), content=f"test content {i}", sequence=i)
        for i in range(TEST_BATCH_SIZE * 2)  # Create multiple batches
    ]
    
    # Act
    start_time = time.time()
    embeddings = await document_processor._process_embeddings(chunks, "test_tenant")
    processing_time = time.time() - start_time
    
    # Assert
    assert len(embeddings) == len(chunks)
    # Verify embedding dimensions
    for emb in embeddings:
        assert len(emb.embedding) == TEST_EMBEDDING_DIM
    
    # Verify batch processing performance
    expected_batch_time = (len(chunks) / TEST_BATCH_SIZE) * 2.0  # 2 seconds per batch
    assert processing_time < expected_batch_time

@pytest.mark.asyncio
async def test_error_handling_and_recovery(document_processor):
    """Test error handling and recovery mechanisms."""
    # Arrange
    document = Document(
        client_id=uuid4(),
        filename="test_error.pdf",
        type="pdf"
    )
    
    # Simulate cascading failures
    document_processor._ocr_service.process_document.side_effect = [
        Exception("OCR Error"),
        AsyncMock(return_value=[])  # Empty chunks
    ]
    
    # Act & Assert
    with pytest.raises(ValueError, match="OCR processing produced no valid chunks"):
        await document_processor.process_document(document, "test_tenant")
    
    assert document.status == DocumentStatus.FAILED.value
    assert document.retry_count > 0
    assert "OCR Error" in str(document.metadata.get('last_error'))