"""
Advanced utility module for GPU-accelerated document processing and manipulation.
Implements high-performance OCR preprocessing, semantic chunking, and robust error handling.

Version: 1.0.0
"""

import os  # version: latest
import magic  # version: ^0.4.27
import fitz  # version: ^1.22.0
import numpy as np  # version: ^1.24.0
import cv2  # version: ^4.8.0
import torch  # version: ^2.0.0
import logging
from typing import Dict, List, Tuple, Optional
from functools import wraps
from hashlib import sha256

from app.models.document import Document
from app.config import settings

# Initialize logger
logger = logging.getLogger(__name__)

# Constants from settings
SUPPORTED_FILE_TYPES = settings._settings['document_processing']['supported_file_types']
MAX_FILE_SIZE = settings._settings['document_processing']['max_file_size']
OCR_SETTINGS = settings._settings['document_processing']['ocr_settings']
CHUNK_SETTINGS = settings._settings['document_processing']['chunk_settings']

def handle_processing_errors(func):
    """Decorator for consistent error handling in document processing functions."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}", exc_info=True)
            raise RuntimeError(f"Document processing error: {str(e)}")
    return wrapper

@handle_processing_errors
def validate_file_type(file_path: str, strict_validation: bool = True) -> Tuple[bool, str]:
    """
    Validates file type and security constraints with enhanced MIME detection.
    
    Args:
        file_path (str): Path to the file for validation
        strict_validation (bool): Enable additional security checks
        
    Returns:
        Tuple[bool, str]: (validation_result, error_message)
    """
    if not os.path.exists(file_path):
        return False, "File does not exist"
        
    # Verify file permissions
    if not os.access(file_path, os.R_OK):
        return False, "File is not readable"
        
    # Get file size
    file_size = os.path.getsize(file_path)
    if file_size > MAX_FILE_SIZE:
        return False, f"File size exceeds maximum limit of {MAX_FILE_SIZE} bytes"
        
    # Secure MIME type detection
    try:
        mime = magic.Magic(mime=True)
        file_type = mime.from_file(file_path)
        
        # Validate against whitelist
        if file_type not in SUPPORTED_FILE_TYPES:
            return False, f"Unsupported file type: {file_type}"
            
        if strict_validation:
            # Calculate file hash for integrity check
            with open(file_path, 'rb') as f:
                file_hash = sha256(f.read()).hexdigest()
                
            # Additional security checks
            if file_type.startswith('application/x-'):
                return False, "Potentially unsafe file type"
                
            # Verify file extension matches content
            extension = os.path.splitext(file_path)[1].lower()
            if not any(ext in extension for ext in SUPPORTED_FILE_TYPES):
                return False, "File extension does not match content type"
                
        return True, ""
        
    except Exception as e:
        return False, f"File validation error: {str(e)}"

@handle_processing_errors
def get_file_metadata(file_path: str, extract_content_info: bool = False) -> Dict:
    """
    Extracts comprehensive metadata with format-specific handling.
    
    Args:
        file_path (str): Path to the document file
        extract_content_info (bool): Include content analysis in metadata
        
    Returns:
        Dict: Extensive document metadata
    """
    metadata = {
        'file_info': {
            'size': os.path.getsize(file_path),
            'created': os.path.getctime(file_path),
            'modified': os.path.getmtime(file_path),
            'hash': None
        },
        'content_info': {},
        'technical_info': {}
    }
    
    # Calculate file hash
    with open(file_path, 'rb') as f:
        metadata['file_info']['hash'] = sha256(f.read()).hexdigest()
    
    # Extract format-specific metadata
    extension = os.path.splitext(file_path)[1].lower()
    
    if extension == '.pdf':
        with fitz.open(file_path) as doc:
            metadata['technical_info'].update({
                'page_count': len(doc),
                'pdf_version': doc.metadata.get('format', ''),
                'title': doc.metadata.get('title', ''),
                'author': doc.metadata.get('author', ''),
                'creation_date': doc.metadata.get('creationDate', ''),
                'modification_date': doc.metadata.get('modDate', '')
            })
            
            if extract_content_info:
                metadata['content_info'].update({
                    'text_percentage': sum(1 for page in doc if page.get_text()),
                    'has_images': any(page.get_images() for page in doc),
                    'language_info': detect_document_language(doc)
                })
    
    return metadata

@torch.cuda.amp.autocast()
@handle_processing_errors
def prepare_for_ocr(document: Document, preprocessing_options: Dict) -> Tuple[torch.Tensor, Dict]:
    """
    GPU-accelerated document preprocessing for optimal OCR.
    
    Args:
        document (Document): Document model instance
        preprocessing_options (Dict): Preprocessing configuration
        
    Returns:
        Tuple[torch.Tensor, Dict]: GPU-optimized image tensor and processing metadata
    """
    # Initialize GPU context
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        device = torch.device('cuda')
    else:
        device = torch.device('cpu')
        logger.warning("GPU not available, falling back to CPU processing")
    
    # Load document with format-specific handling
    image = cv2.imread(document.file_path)
    if image is None:
        raise ValueError("Failed to load document image")
    
    # Convert to grayscale for processing
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Resolution enhancement to 300 DPI
    scale_factor = 300 / preprocessing_options.get('source_dpi', 72)
    if scale_factor > 1:
        gray = cv2.resize(gray, None, fx=scale_factor, fy=scale_factor, 
                         interpolation=cv2.INTER_LANCZOS4)
    
    # Contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=preprocessing_options.get('clahe_clip_limit', 2.0),
                           tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # Noise reduction with edge preservation
    denoised = cv2.fastNlMeansDenoising(enhanced,
                                       h=preprocessing_options.get('denoise_strength', 10),
                                       templateWindowSize=7,
                                       searchWindowSize=21)
    
    # Convert to GPU tensor
    tensor = torch.from_numpy(denoised).float().to(device)
    tensor = tensor.unsqueeze(0).unsqueeze(0)  # Add batch and channel dimensions
    
    # Normalize tensor
    tensor = tensor / 255.0
    
    processing_metadata = {
        'device': str(device),
        'original_shape': image.shape,
        'processed_shape': tensor.shape,
        'preprocessing_steps': ['grayscale', 'resolution', 'contrast', 'denoise'],
        'scale_factor': scale_factor
    }
    
    return tensor, processing_metadata

@handle_processing_errors
def split_into_chunks(content: str, chunk_size: int = CHUNK_SETTINGS['chunk_size'],
                     overlap_ratio: float = CHUNK_SETTINGS['overlap_ratio'],
                     chunking_options: Dict = None) -> List[Dict]:
    """
    Intelligent content chunking with semantic boundary preservation.
    
    Args:
        content (str): Document content to chunk
        chunk_size (int): Target size for each chunk
        overlap_ratio (float): Overlap between consecutive chunks
        chunking_options (Dict): Additional chunking configuration
        
    Returns:
        List[Dict]: List of chunks with metadata and relationships
    """
    if not content:
        return []
    
    chunks = []
    options = CHUNK_SETTINGS.copy()
    if chunking_options:
        options.update(chunking_options)
    
    # Clean and normalize content
    content = content.strip()
    
    # Identify semantic boundaries
    paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
    
    current_chunk = []
    current_size = 0
    overlap_size = int(chunk_size * overlap_ratio)
    
    for i, paragraph in enumerate(paragraphs):
        paragraph_size = len(paragraph)
        
        if current_size + paragraph_size > chunk_size and current_chunk:
            # Create chunk with metadata
            chunk_text = ' '.join(current_chunk)
            chunks.append({
                'content': chunk_text,
                'size': len(chunk_text),
                'metadata': {
                    'sequence': len(chunks),
                    'paragraphs': len(current_chunk),
                    'has_overlap': bool(i < len(paragraphs) - 1)
                }
            })
            
            # Handle overlap
            overlap_start = max(0, len(chunk_text) - overlap_size)
            current_chunk = [chunk_text[overlap_start:]] if overlap_start > 0 else []
            current_size = len(current_chunk[0]) if current_chunk else 0
        
        current_chunk.append(paragraph)
        current_size += paragraph_size
    
    # Handle remaining content
    if current_chunk:
        chunk_text = ' '.join(current_chunk)
        chunks.append({
            'content': chunk_text,
            'size': len(chunk_text),
            'metadata': {
                'sequence': len(chunks),
                'paragraphs': len(current_chunk),
                'has_overlap': False
            }
        })
    
    return chunks

def detect_document_language(doc) -> Dict:
    """
    Helper function to detect document language and script.
    
    Args:
        doc: Document object (PDF/Word)
        
    Returns:
        Dict: Language detection results
    """
    # Implementation would integrate with language detection service
    # Placeholder for demonstration
    return {
        'primary_language': 'en',
        'confidence': 0.95,
        'scripts_detected': ['Latin']
    }