"""
Test suite for OCR service validating document processing, text extraction accuracy,
GPU-accelerated OCR operations, and performance metrics using NVidia OCR SDK.

Version: 1.0.0
"""

import pytest  # version: ^7.4.0
import pytest_asyncio  # version: ^0.21.0
import numpy as np  # version: ^1.24.0
from unittest.mock import Mock, patch, AsyncMock  # version: latest
import torch
import os
from datetime import datetime

from app.services.ocr_service import OCRService
from app.models.document import Document
from app.utils.document_utils import validate_file_type, prepare_for_ocr
from app.config import settings

class TestOCRService:
    """Test class for OCR service functionality with GPU acceleration."""

    def __init__(self):
        """Set up test environment with GPU configuration."""
        self._test_config = {
            'batch_size': 32,
            'num_threads': 4,
            'gpu_memory_limit': 0.8,
            'max_concurrent_processes': 4
        }
        self._gpu_config = {
            'device_id': 0,
            'cuda_version': '11.8',
            'target_dpi': 300
        }
        self._test_data_path = os.path.join(os.path.dirname(__file__), 'test_data')

    async def setup_method(self, method):
        """Set up test method with fresh GPU resources."""
        # Reset test configuration
        self._test_config = self._test_config.copy()
        
        # Clear GPU memory
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        # Create test data directory
        os.makedirs(self._test_data_path, exist_ok=True)
        
        # Initialize performance monitoring
        self._performance_metrics = {
            'processing_times': [],
            'memory_usage': [],
            'gpu_utilization': []
        }

    async def teardown_method(self, method):
        """Clean up GPU resources after test."""
        # Release GPU resources
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        # Clean up test files
        for file in os.listdir(self._test_data_path):
            os.remove(os.path.join(self._test_data_path, file))
        
        # Reset metrics
        self._performance_metrics = None

@pytest.fixture
def mock_nvidia_sdk():
    """Fixture providing mocked NVidia OCR SDK with GPU support."""
    with patch('nvidia.dali.Pipeline') as mock_pipeline:
        # Configure mock pipeline
        mock_pipeline.return_value = Mock(
            build=Mock(),
            run=Mock(return_value=[{
                'text': 'Sample text content',
                'layout': {'width': 100, 'height': 100},
                'confidence': 0.95,
                'processing_time': 0.1
            }])
        )
        
        # Mock CUDA context
        with patch('torch.cuda') as mock_cuda:
            mock_cuda.is_available.return_value = True
            mock_cuda.device_count.return_value = 1
            mock_cuda.get_device_properties.return_value = Mock(
                total_memory=8 * 1024 * 1024 * 1024  # 8GB
            )
            yield mock_pipeline

@pytest.fixture
async def test_document():
    """Fixture providing test document with known content."""
    # Create test document
    doc = Document(
        client_id='test-client',
        filename='test_document.pdf',
        type='pdf',
        metadata={
            'page_count': 1,
            'content_type': 'application/pdf'
        }
    )
    
    # Set up test file
    test_file_path = os.path.join(os.path.dirname(__file__), 'test_data', doc.filename)
    with open(test_file_path, 'w') as f:
        f.write('Test document content with known patterns')
    
    doc.file_path = test_file_path
    return doc

@pytest.mark.asyncio
async def test_ocr_service_initialization(mock_nvidia_sdk):
    """Test OCR service initialization with GPU configuration and pipeline setup."""
    # Arrange
    config = {
        'batch_size': 32,
        'num_threads': 4,
        'gpu_memory_limit': 0.8,
        'max_concurrent_processes': 4
    }
    
    # Act
    service = OCRService(config)
    
    # Assert
    assert service._pipeline is not None
    assert service._gpu_resources['memory_limit'] == 0.8
    assert service._gpu_resources['max_concurrent'] == 4
    mock_nvidia_sdk.assert_called_once_with(
        batch_size=32,
        num_threads=4,
        device_id=0
    )

@pytest.mark.asyncio
async def test_process_document_success(mock_nvidia_sdk, test_document):
    """Test successful document processing with performance metrics."""
    # Arrange
    service = OCRService({
        'batch_size': 32,
        'num_threads': 4,
        'gpu_memory_limit': 0.8
    })
    
    # Act
    start_time = datetime.now()
    chunks = await service.process_document(test_document)
    processing_time = (datetime.now() - start_time).total_seconds()
    
    # Assert
    assert len(chunks) > 0
    assert all(chunk.content for chunk in chunks)
    assert all(chunk.metadata['confidence_score'] > 0.9 for chunk in chunks)
    assert processing_time < 1.0  # Verify 3 pages/second requirement
    
    # Verify document status updates
    assert test_document.status == 'completed'
    assert test_document.metadata['ocr_quality_score'] > 0.9
    assert 'processing_stats' in test_document.metadata

@pytest.mark.asyncio
async def test_gpu_resource_management(mock_nvidia_sdk):
    """Test GPU resource allocation and cleanup."""
    # Arrange
    service = OCRService({
        'batch_size': 32,
        'num_threads': 4,
        'gpu_memory_limit': 0.8
    })
    
    # Act & Assert
    async with service._acquire_gpu_resources():
        assert service._gpu_resources['active_processes'] == 1
        
        # Test concurrent access
        with pytest.raises(RuntimeError):
            async with service._acquire_gpu_resources():
                pass
    
    # Verify cleanup
    assert service._gpu_resources['active_processes'] == 0
    mock_nvidia_sdk.assert_called()

@pytest.mark.asyncio
async def test_processing_performance(mock_nvidia_sdk, test_document):
    """Test OCR processing performance metrics."""
    # Arrange
    service = OCRService({
        'batch_size': 32,
        'num_threads': 4,
        'gpu_memory_limit': 0.8
    })
    
    # Act
    performance_metrics = []
    for _ in range(5):  # Process multiple times to get average metrics
        start_time = datetime.now()
        chunks = await service.process_document(test_document)
        processing_time = (datetime.now() - start_time).total_seconds()
        performance_metrics.append({
            'processing_time': processing_time,
            'chunk_count': len(chunks),
            'avg_confidence': np.mean([
                chunk.metadata['confidence_score'] for chunk in chunks
            ])
        })
    
    # Assert
    avg_processing_time = np.mean([m['processing_time'] for m in performance_metrics])
    avg_confidence = np.mean([m['avg_confidence'] for m in performance_metrics])
    
    assert avg_processing_time < 1.0  # Verify performance requirement
    assert avg_confidence > 0.95  # Verify accuracy requirement
    assert all(m['chunk_count'] > 0 for m in performance_metrics)