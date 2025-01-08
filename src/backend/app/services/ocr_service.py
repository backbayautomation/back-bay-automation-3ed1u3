"""
OCR Service module implementing high-performance document text extraction using NVidia OCR SDK.
Provides GPU-accelerated processing with comprehensive error handling and quality assurance.

Version: 1.0.0
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
import nvidia.dali as dali  # version: 1.25.0
import numpy as np  # version: 1.24.0

from app.models.document import Document
from app.models.chunk import Chunk
from app.utils.document_utils import validate_file_type, prepare_for_ocr
from app.config import settings

# Configure logging
logger = logging.getLogger(__name__)

class OCRService:
    """
    Service class for performing OCR operations on documents using NVidia OCR with GPU acceleration.
    Implements comprehensive error handling, performance optimization, and quality assurance.
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize OCR service with GPU configuration and performance settings.

        Args:
            config: Configuration dictionary for OCR service
        """
        self._config = config
        self._logger = logging.getLogger(__name__)
        
        # Initialize GPU pipeline
        self._pipeline = self._initialize_pipeline()
        
        # Track GPU resources
        self._gpu_resources = {
            'memory_limit': config.get('gpu_memory_limit', 0.8),  # 80% GPU memory limit
            'active_processes': 0,
            'max_concurrent': config.get('max_concurrent_processes', 4)
        }
        
        # Performance metrics tracking
        self._performance_metrics = {
            'processed_documents': 0,
            'total_processing_time': 0,
            'error_count': 0,
            'retry_count': 0
        }

    def _initialize_pipeline(self) -> dali.Pipeline:
        """
        Initialize NVidia DALI pipeline with optimized settings.

        Returns:
            Configured DALI pipeline instance
        """
        pipeline = dali.Pipeline(
            batch_size=self._config.get('batch_size', 32),
            num_threads=self._config.get('num_threads', 4),
            device_id=0
        )
        
        # Configure pipeline operations
        with pipeline:
            # Image decode and normalize operations
            images = dali.fn.external_source(device="cpu", name="raw_images")
            images = dali.fn.image_decoder(images, device="mixed")
            images = dali.fn.normalize(images)
            
            # GPU acceleration settings
            pipeline.set_outputs(images)
        
        pipeline.build()
        return pipeline

    async def process_document(self, document: Document) -> List[Chunk]:
        """
        Process document through OCR pipeline with error handling and quality assurance.

        Args:
            document: Document model instance to process

        Returns:
            List of processed text chunks with metadata

        Raises:
            ValueError: If document validation fails
            RuntimeError: If processing fails after retries
        """
        try:
            # Validate document
            is_valid, error_msg = validate_file_type(document.filename)
            if not is_valid:
                await document.update_status('failed')
                raise ValueError(f"Document validation failed: {error_msg}")

            # Update document status
            await document.update_status('processing')
            
            # Prepare document for OCR
            image_tensor, preprocessing_metadata = await prepare_for_ocr(
                document,
                preprocessing_options={
                    'target_dpi': 300,
                    'enhance_contrast': True,
                    'reduce_noise': True
                }
            )
            
            # Process with GPU acceleration
            processed_chunks = []
            async with self._acquire_gpu_resources():
                # Run OCR pipeline
                pipeline_output = self._pipeline.run([image_tensor])
                ocr_results = self._process_pipeline_output(pipeline_output)
                
                # Create chunks with metadata
                for idx, result in enumerate(ocr_results):
                    processed_text, layout_info = self.postprocess_text(
                        result['text'],
                        result['layout']
                    )
                    
                    chunk = Chunk(
                        document_id=document.id,
                        content=processed_text,
                        sequence=idx,
                        metadata={
                            'layout_info': layout_info,
                            'preprocessing': preprocessing_metadata,
                            'confidence_score': result['confidence'],
                            'processing_time': result['processing_time']
                        }
                    )
                    processed_chunks.append(chunk)
            
            # Update document status and metadata
            await document.update_status('completed')
            await document.update_metadata({
                'ocr_quality_score': self._calculate_quality_score(processed_chunks),
                'processing_stats': {
                    'chunk_count': len(processed_chunks),
                    'total_characters': sum(len(chunk.content) for chunk in processed_chunks),
                    'average_confidence': np.mean([
                        chunk.metadata['confidence_score'] for chunk in processed_chunks
                    ])
                }
            })
            
            return processed_chunks

        except Exception as e:
            self._logger.error(f"OCR processing error: {str(e)}", exc_info=True)
            self._performance_metrics['error_count'] += 1
            await document.update_status('failed')
            raise RuntimeError(f"OCR processing failed: {str(e)}")

    def _process_pipeline_output(self, pipeline_output: Any) -> List[Dict[str, Any]]:
        """
        Process raw pipeline output into structured OCR results.

        Args:
            pipeline_output: Raw output from DALI pipeline

        Returns:
            List of processed OCR results with metadata
        """
        results = []
        for output in pipeline_output:
            text_blocks = output.as_cpu().as_array()
            for block in text_blocks:
                results.append({
                    'text': block['text'],
                    'layout': block['layout'],
                    'confidence': block['confidence'],
                    'processing_time': block['processing_time']
                })
        return results

    async def _acquire_gpu_resources(self):
        """
        Acquire GPU resources with resource management and queuing.

        Yields:
            Context manager for GPU resource allocation
        """
        while self._gpu_resources['active_processes'] >= self._gpu_resources['max_concurrent']:
            await asyncio.sleep(0.1)
        
        self._gpu_resources['active_processes'] += 1
        try:
            yield
        finally:
            self._gpu_resources['active_processes'] -= 1

    def _calculate_quality_score(self, chunks: List[Chunk]) -> float:
        """
        Calculate overall OCR quality score based on multiple metrics.

        Args:
            chunks: List of processed chunks

        Returns:
            Float quality score between 0 and 1
        """
        if not chunks:
            return 0.0
            
        confidence_scores = [chunk.metadata['confidence_score'] for chunk in chunks]
        avg_confidence = np.mean(confidence_scores)
        min_confidence = np.min(confidence_scores)
        
        # Weight different factors for final score
        weights = {
            'avg_confidence': 0.6,
            'min_confidence': 0.3,
            'layout_quality': 0.1
        }
        
        layout_quality = np.mean([
            len(chunk.metadata['layout_info']) > 0 for chunk in chunks
        ])
        
        quality_score = (
            weights['avg_confidence'] * avg_confidence +
            weights['min_confidence'] * min_confidence +
            weights['layout_quality'] * layout_quality
        )
        
        return float(np.clip(quality_score, 0.0, 1.0))

    def postprocess_text(self, text: str, layout_info: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
        """
        Clean and structure OCR output text with layout preservation.

        Args:
            text: Raw OCR text
            layout_info: Layout information from OCR

        Returns:
            Tuple of (processed text, enhanced metadata)
        """
        # Clean common OCR artifacts
        cleaned_text = text.strip()
        cleaned_text = ' '.join(cleaned_text.split())
        
        # Enhance layout information
        enhanced_layout = {
            'original': layout_info,
            'structure': {
                'paragraphs': self._detect_paragraphs(cleaned_text),
                'tables': self._detect_tables(layout_info),
                'formatting': self._detect_formatting(cleaned_text, layout_info)
            },
            'quality_metrics': {
                'text_density': len(cleaned_text) / (layout_info['width'] * layout_info['height']),
                'structure_confidence': self._calculate_structure_confidence(layout_info)
            }
        }
        
        return cleaned_text, enhanced_layout

    def _detect_paragraphs(self, text: str) -> List[Dict[str, Any]]:
        """Detect paragraph structures in text."""
        paragraphs = []
        current_offset = 0
        
        for block in text.split('\n\n'):
            if block.strip():
                paragraphs.append({
                    'text': block.strip(),
                    'offset': current_offset,
                    'length': len(block)
                })
                current_offset += len(block) + 2
                
        return paragraphs

    def _detect_tables(self, layout_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect and structure table layouts."""
        tables = []
        if 'tables' in layout_info:
            for table in layout_info['tables']:
                tables.append({
                    'bounds': table['bounds'],
                    'rows': len(table['cells']) if 'cells' in table else 0,
                    'columns': len(table['cells'][0]) if 'cells' in table and table['cells'] else 0,
                    'confidence': table.get('confidence', 0.0)
                })
        return tables

    def _detect_formatting(self, text: str, layout_info: Dict[str, Any]) -> Dict[str, Any]:
        """Detect text formatting and structure."""
        return {
            'line_breaks': text.count('\n'),
            'alignment': layout_info.get('alignment', 'left'),
            'font_sizes': layout_info.get('font_sizes', []),
            'styles': layout_info.get('styles', [])
        }

    def _calculate_structure_confidence(self, layout_info: Dict[str, Any]) -> float:
        """Calculate confidence score for structural detection."""
        confidence_factors = [
            layout_info.get('alignment_confidence', 0.0),
            layout_info.get('table_confidence', 0.0) if 'tables' in layout_info else 1.0,
            layout_info.get('text_recognition_confidence', 0.0)
        ]
        return float(np.mean([c for c in confidence_factors if c > 0]))