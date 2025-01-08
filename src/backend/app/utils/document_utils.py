"""
Advanced utility module for GPU-accelerated document processing and manipulation.
Implements high-performance OCR preprocessing, semantic chunking, and robust error handling.

Version: 1.0.0
"""

import os  # version: latest
import magic  # version: 0.4.27
import fitz  # version: 1.22.0
import numpy as np  # version: 1.24.0
import cv2  # version: 4.8.0
import torch  # version: 2.0.0
import logging
from functools import wraps
from typing import Tuple, Dict, List, Optional
from hashlib import sha256
from datetime import datetime

from app.models.document import Document
from app.config import settings

# Initialize GPU context if available
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
logger = logging.getLogger(__name__)

def handle_processing_error(func):
    """Decorator for consistent error handling in document processing functions."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}", 
                        extra={'error_type': type(e).__name__})
            raise RuntimeError(f"Document processing error: {str(e)}")
    return wrapper

def validate_file_type(file_path: str, strict_validation: bool = True) -> Tuple[bool, str]:
    """
    Validates file type and security constraints with enhanced MIME detection.
    
    Args:
        file_path: Path to the file for validation
        strict_validation: Enable additional security checks
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Verify file existence and permissions
        if not os.path.exists(file_path):
            return False, "File does not exist"
        
        # Get file size
        file_size = os.path.getsize(file_path)
        if file_size > settings.MAX_FILE_SIZE:
            return False, f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE} bytes"
        
        # Secure MIME type detection
        mime_type = magic.from_file(file_path, mime=True)
        file_type = mime_type.split('/')[-1].lower()
        
        if file_type not in settings.SUPPORTED_FILE_TYPES:
            return False, f"Unsupported file type: {file_type}"
        
        if strict_validation:
            # Additional security checks
            with open(file_path, 'rb') as f:
                header = f.read(8192)
                # Check for executable content
                if b'ELF' in header or b'MZ' in header:
                    return False, "File contains executable content"
                
                # Validate file signature
                signatures = {
                    'pdf': b'%PDF',
                    'docx': b'PK\x03\x04',
                    'xlsx': b'PK\x03\x04'
                }
                if not header.startswith(signatures.get(file_type, b'')):
                    return False, "Invalid file signature"
        
        return True, ""
        
    except Exception as e:
        logger.error(f"File validation error: {str(e)}")
        return False, f"Validation error: {str(e)}"

def get_file_metadata(file_path: str, extract_content_info: bool = True) -> Dict:
    """
    Extracts comprehensive metadata with format-specific handling.
    
    Args:
        file_path: Path to the document file
        extract_content_info: Whether to extract content-specific metadata
        
    Returns:
        Dictionary containing document metadata
    """
    try:
        # Basic file information
        stats = os.stat(file_path)
        file_type = magic.from_file(file_path, mime=True).split('/')[-1].lower()
        
        # Calculate file hash
        with open(file_path, 'rb') as f:
            file_hash = sha256(f.read()).hexdigest()
        
        metadata = {
            'file_info': {
                'size': stats.st_size,
                'created_at': datetime.fromtimestamp(stats.st_ctime).isoformat(),
                'modified_at': datetime.fromtimestamp(stats.st_mtime).isoformat(),
                'hash': file_hash,
                'mime_type': file_type
            },
            'processing_info': {
                'processed_at': datetime.utcnow().isoformat(),
                'processor_version': '1.0.0'
            }
        }
        
        if extract_content_info:
            if file_type == 'pdf':
                with fitz.open(file_path) as doc:
                    metadata['content_info'] = {
                        'page_count': len(doc),
                        'title': doc.metadata.get('title'),
                        'author': doc.metadata.get('author'),
                        'creation_date': doc.metadata.get('creationDate'),
                        'page_sizes': [page.rect.size for page in doc]
                    }
            # Add handlers for other document types as needed
        
        return metadata
        
    except Exception as e:
        logger.error(f"Metadata extraction error: {str(e)}")
        raise RuntimeError(f"Failed to extract metadata: {str(e)}")

@torch.cuda.amp.autocast()
@handle_processing_error
async def prepare_for_ocr(document: Document, preprocessing_options: Optional[Dict] = None) -> Tuple[torch.Tensor, Dict]:
    """
    GPU-accelerated document preprocessing for optimal OCR.
    
    Args:
        document: Document model instance
        preprocessing_options: Optional preprocessing configuration
        
    Returns:
        Tuple of (processed image tensor, preprocessing metadata)
    """
    options = preprocessing_options or settings.OCR_SETTINGS
    
    try:
        # Initialize GPU memory management
        torch.cuda.empty_cache()
        
        # Load document based on type
        if document.type == 'pdf':
            doc = fitz.open(document.file_path)
            # Convert PDF to image
            page = doc[0]
            pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width, pix.n)
        else:
            img = cv2.imread(document.file_path)
        
        # Image preprocessing pipeline
        # Convert to grayscale while preserving important features
        if len(img.shape) == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Resolution enhancement
        img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        
        # Contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        img = clahe.apply(img)
        
        # Noise reduction while preserving text edges
        img = cv2.fastNlMeansDenoising(img, None, h=10, templateWindowSize=7, searchWindowSize=21)
        
        # Convert to tensor and move to GPU
        tensor = torch.from_numpy(img).float().to(DEVICE)
        tensor = tensor.unsqueeze(0).unsqueeze(0)  # Add batch and channel dimensions
        
        # Normalize
        tensor = tensor / 255.0
        
        preprocessing_metadata = {
            'original_size': img.shape,
            'tensor_size': tensor.shape,
            'device': str(DEVICE),
            'preprocessing_steps': [
                'resolution_enhancement',
                'contrast_adjustment',
                'noise_reduction',
                'normalization'
            ]
        }
        
        return tensor, preprocessing_metadata
        
    except Exception as e:
        logger.error(f"OCR preprocessing error: {str(e)}")
        raise RuntimeError(f"Failed to prepare document for OCR: {str(e)}")

def split_into_chunks(content: str, chunk_size: int = 1000, 
                     overlap_ratio: float = 0.2,
                     chunking_options: Optional[Dict] = None) -> List[Dict]:
    """
    Intelligent content chunking with semantic boundary preservation.
    
    Args:
        content: Document content to chunk
        chunk_size: Target size for each chunk
        overlap_ratio: Ratio of overlap between chunks
        chunking_options: Additional chunking configuration
        
    Returns:
        List of chunk dictionaries with metadata
    """
    try:
        options = chunking_options or settings.CHUNK_SETTINGS
        chunks = []
        overlap_size = int(chunk_size * overlap_ratio)
        
        # Clean and normalize content
        content = content.strip()
        
        # Identify semantic boundaries
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        current_chunk = []
        current_size = 0
        
        for i, paragraph in enumerate(paragraphs):
            paragraph_size = len(paragraph)
            
            if current_size + paragraph_size > chunk_size:
                # Create chunk with metadata
                chunk_text = ' '.join(current_chunk)
                chunks.append({
                    'content': chunk_text,
                    'size': len(chunk_text),
                    'metadata': {
                        'start_paragraph': i - len(current_chunk),
                        'end_paragraph': i - 1,
                        'paragraph_count': len(current_chunk)
                    }
                })
                
                # Handle overlap
                overlap_text = current_chunk[-1] if current_chunk else ''
                current_chunk = [overlap_text] if overlap_text else []
                current_size = len(overlap_text) if overlap_text else 0
            
            current_chunk.append(paragraph)
            current_size += paragraph_size
        
        # Handle remaining content
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append({
                'content': chunk_text,
                'size': len(chunk_text),
                'metadata': {
                    'start_paragraph': len(paragraphs) - len(current_chunk),
                    'end_paragraph': len(paragraphs) - 1,
                    'paragraph_count': len(current_chunk)
                }
            })
        
        return chunks
        
    except Exception as e:
        logger.error(f"Content chunking error: {str(e)}")
        raise RuntimeError(f"Failed to split content into chunks: {str(e)}")