"""
Comprehensive test suite for OCR service validating GPU-accelerated document processing,
text extraction accuracy, and performance metrics.

Version: 1.0.0
"""

import pytest  # version: 7.4.0
import pytest_asyncio  # version: 0.21.0
import numpy as np  # version: 1.24.0
from unittest.mock import Mock, patch, AsyncMock
import asyncio
import nvidia.dali
import torch

from app.services.ocr_service import OCRService
from app.models.document import Document
from app.config import settings
from app.constants import DocumentStatus

class TestOCRService:
    """Test class for OCR service functionality with GPU acceleration."""

    def __init__(self):
        """Set up test environment with GPU configuration."""
        self._test_config = {
            'batch_size': 32,
            'num_threads': 4,
            'gpu_memory_limit': 0.8,
            'dpi': 300
        }
        self._gpu_config = {
            'device_id': 0,
            'compute_capability': [7, 5],
            'memory_limit': int(8 * 1024 * 1024 * 1024)  # 8GB
        }
        self._test_data_path = 'tests/test_data'

    async def setup_method(self, method):
        """Set up test method with fresh GPU resources."""
        # Reset test configuration
        self._test_config = self._test_config.copy()
        
        # Clear GPU memory
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        # Initialize CUDA context
        nvidia.dali.backend.Init()
        
        # Set up performance monitors
        self._performance_metrics = {
            'processing_time': [],
            'gpu_memory_usage': [],
            'accuracy_scores': []
        }

    async def teardown_method(self, method):
        """Clean up GPU resources after test."""
        # Release GPU memory
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        # Clear CUDA context
        nvidia.dali.backend.ReleaseCache()
        
        # Clean up test files
        await self._cleanup_test_files()
        
        # Reset performance metrics
        self._performance_metrics = {}

    @pytest.fixture
    def mock_nvidia_sdk(self):
        """Fixture providing mocked NVidia OCR SDK with GPU support."""
        with patch('nvidia.dali.Pipeline') as mock_pipeline:
            # Configure mock CUDA context
            mock_pipeline.return_value.is_gpu_available.return_value = True
            
            # Set up mock GPU properties
            mock_pipeline.return_value.get_gpu_properties.return_value = [{
                'total_memory': self._gpu_config['memory_limit'],
                'compute_capability': self._gpu_config['compute_capability']
            }]
            
            # Configure mock OCR operations
            mock_pipeline.return_value.run.return_value = [
                Mock(as_cpu=lambda: Mock(as_array=lambda: np.random.rand(32, 1000))),
                Mock(as_cpu=lambda: Mock(as_array=lambda: np.random.rand(32, 4))),
                Mock(as_cpu=lambda: Mock(as_array=lambda: np.random.rand(32) * 0.95 + 0.05))
            ]
            
            yield mock_pipeline

    @pytest.fixture
    async def test_document(self):
        """Fixture providing test document with known content."""
        document = Document(
            client_id='test-client',
            filename='test_document.pdf',
            type='pdf',
            metadata={
                'page_count': 1,
                'text_content': 'Test content for OCR processing'
            }
        )
        await document.update_status('pending')
        return document

    @pytest.mark.asyncio
    async def test_ocr_service_initialization(self, mock_nvidia_sdk):
        """Test OCR service initialization with GPU configuration."""
        # Create OCR service
        service = OCRService(self._test_config)
        
        # Verify GPU pipeline initialization
        mock_nvidia_sdk.assert_called_once_with(
            batch_size=self._test_config['batch_size'],
            num_threads=self._test_config['num_threads'],
            device_id=0
        )
        
        # Verify GPU resource configuration
        assert service._gpu_resources['memory_limit'] == self._test_config['gpu_memory_limit']
        assert service._gpu_resources['compute_capability'] == mock_nvidia_sdk.return_value.cuda_gpu_capabilities()
        
        # Verify performance metrics initialization
        assert service._performance_metrics['total_documents'] == 0
        assert service._performance_metrics['successful_processes'] == 0

    @pytest.mark.asyncio
    async def test_process_document_success(self, mock_nvidia_sdk, test_document):
        """Test successful document processing with performance metrics."""
        # Initialize service
        service = OCRService(self._test_config)
        
        # Process document
        chunks = await service.process_document(test_document)
        
        # Verify document processing
        assert len(chunks) > 0
        assert all(chunk.document_id == test_document.id for chunk in chunks)
        
        # Verify processing performance
        assert test_document.status == 'completed'
        assert test_document.metadata['processing_time'] > 0
        assert test_document.metadata['ocr_quality_metrics']['average_confidence'] > 0.95
        
        # Verify GPU resource cleanup
        mock_nvidia_sdk.return_value.reset.assert_called_once()

    @pytest.mark.asyncio
    async def test_gpu_resource_management(self, mock_nvidia_sdk):
        """Test GPU resource allocation and cleanup."""
        service = OCRService(self._test_config)
        
        # Monitor initial GPU state
        initial_memory = nvidia.dali.backend.memory_info()[0]['free']
        
        async with service._acquire_gpu_resources():
            # Verify GPU memory allocation
            current_memory = nvidia.dali.backend.memory_info()[0]['free']
            assert current_memory < initial_memory
            
            # Verify pipeline configuration
            assert service._pipeline is not None
            
        # Verify GPU resource cleanup
        final_memory = nvidia.dali.backend.memory_info()[0]['free']
        assert final_memory == initial_memory

    @pytest.mark.asyncio
    async def test_processing_performance(self, mock_nvidia_sdk, test_document):
        """Test OCR processing performance metrics."""
        service = OCRService(self._test_config)
        
        # Process multiple pages
        processing_times = []
        for _ in range(3):
            start_time = asyncio.get_event_loop().time()
            chunks = await service.process_document(test_document)
            processing_time = asyncio.get_event_loop().time() - start_time
            processing_times.append(processing_time)
            
            # Verify processing speed (3 pages/second requirement)
            assert processing_time < 1.0  # Less than 1 second per page
            
            # Verify OCR accuracy (>95% requirement)
            assert test_document.metadata['ocr_quality_metrics']['average_confidence'] > 0.95
            
            # Verify memory usage
            gpu_memory = nvidia.dali.backend.memory_info()[0]['used']
            assert gpu_memory < self._gpu_config['memory_limit']
        
        # Verify consistent performance
        avg_processing_time = sum(processing_times) / len(processing_times)
        assert avg_processing_time < 0.5  # Average processing time under 0.5 seconds