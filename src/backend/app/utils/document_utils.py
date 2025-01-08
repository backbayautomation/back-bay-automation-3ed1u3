import os
import magic  # version: ^0.4.27
import fitz  # version: ^1.22.0
import numpy as np  # version: ^1.24.0
import cv2  # version: ^4.8.0
import torch  # version: ^2.0.0
import logging
from functools import wraps
from typing import Tuple, Dict, List, Optional, Any
from pathlib import Path

from app.models.document import Document
from app.config import settings

# Configure logging
logger = logging.getLogger(__name__)

def retry(max_attempts: int = 3, delay: int = 1):
    """Retry decorator with exponential backoff."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        wait_time = delay * (2 ** attempt)
                        logger.warning(f"Attempt {attempt + 1} failed, retrying in {wait_time}s: {str(e)}")
                        await asyncio.sleep(wait_time)
            raise last_exception
        return wrapper
    return decorator

def validate_file_type(file_path: str, strict_validation: bool = True) -> Tuple[bool, str]:
    """
    Validates file type and security constraints with enhanced MIME detection.
    
    Args:
        file_path: Path to the file to validate
        strict_validation: Enable additional security checks
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        if not os.path.exists(file_path):
            return False, "File does not exist"

        # Secure file type detection using python-magic
        mime = magic.Magic(mime=True)
        file_type = mime.from_file(file_path)
        
        # Get file extension and size
        file_ext = Path(file_path).suffix.lower().lstrip('.')
        file_size = os.path.getsize(file_path)
        
        # Validate against supported types
        supported_types = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        
        if file_ext not in supported_types:
            return False, f"Unsupported file extension: {file_ext}"
            
        if file_type != supported_types[file_ext]:
            return False, f"MIME type mismatch: expected {supported_types[file_ext]}, got {file_type}"
            
        # Size validation
        max_size = settings.MAX_FILE_SIZE * 1024 * 1024  # Convert to bytes
        if file_size > max_size:
            return False, f"File size exceeds maximum limit of {settings.MAX_FILE_SIZE}MB"
            
        # Additional security checks for strict validation
        if strict_validation:
            # Check for executable content
            with open(file_path, 'rb') as f:
                header = f.read(4)
                if header.startswith(b'MZ') or header.startswith(b'%PDF-'):
                    content = f.read()
                    if b'JavaScript' in content or b'/JS' in content:
                        return False, "File contains potentially malicious content"
                        
        return True, ""
        
    except Exception as e:
        logger.error(f"File validation error: {str(e)}", exc_info=True)
        return False, f"Validation error: {str(e)}"

def get_file_metadata(file_path: str, extract_content_info: bool = True) -> Dict[str, Any]:
    """
    Extracts comprehensive metadata with format-specific handling.
    
    Args:
        file_path: Path to the file
        extract_content_info: Whether to extract content-related metadata
        
    Returns:
        Dictionary containing file metadata
    """
    try:
        metadata = {
            'file_info': {
                'size': os.path.getsize(file_path),
                'created': os.path.getctime(file_path),
                'modified': os.path.getmtime(file_path),
                'extension': Path(file_path).suffix.lower(),
                'mime_type': magic.Magic(mime=True).from_file(file_path)
            }
        }
        
        # Format-specific metadata extraction
        if metadata['file_info']['extension'] == '.pdf':
            with fitz.open(file_path) as pdf:
                metadata['pdf_info'] = {
                    'page_count': len(pdf),
                    'title': pdf.metadata.get('title'),
                    'author': pdf.metadata.get('author'),
                    'creation_date': pdf.metadata.get('creationDate'),
                    'producer': pdf.metadata.get('producer'),
                    'encryption': bool(pdf.is_encrypted),
                    'layout': pdf.is_reflowable
                }
                
                if extract_content_info:
                    metadata['content_info'] = {
                        'text_blocks': sum(len(page.get_text("blocks")) for page in pdf),
                        'image_count': sum(len(page.get_images()) for page in pdf),
                        'form_fields': sum(len(page.widgets()) for page in pdf)
                    }
                    
        # Add hash for integrity verification
        import hashlib
        with open(file_path, 'rb') as f:
            metadata['file_info']['sha256'] = hashlib.sha256(f.read()).hexdigest()
            
        return metadata
        
    except Exception as e:
        logger.error(f"Metadata extraction error: {str(e)}", exc_info=True)
        raise

@torch.cuda.amp.autocast()
@retry(max_attempts=3, delay=1)
async def prepare_for_ocr(document: Document, preprocessing_options: Dict[str, Any]) -> Tuple[torch.Tensor, Dict[str, Any]]:
    """
    GPU-accelerated document preprocessing for optimal OCR.
    
    Args:
        document: Document model instance
        preprocessing_options: Dictionary of preprocessing parameters
        
    Returns:
        Tuple of (processed image tensor, preprocessing metadata)
    """
    try:
        # Initialize GPU context
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            device = torch.device('cuda')
        else:
            device = torch.device('cpu')
            logger.warning("GPU not available, falling back to CPU")
            
        # Load and normalize image
        image = cv2.imread(document.file_path)
        if image is None:
            raise ValueError("Failed to load image")
            
        # Resolution enhancement
        target_dpi = preprocessing_options.get('target_dpi', 300)
        scale_factor = target_dpi / preprocessing_options.get('source_dpi', 72)
        if scale_factor > 1:
            image = cv2.resize(image, None, fx=scale_factor, fy=scale_factor, 
                             interpolation=cv2.INTER_CUBIC)
                             
        # Contrast enhancement
        if preprocessing_options.get('enhance_contrast', True):
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            l = clahe.apply(l)
            image = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
            
        # Noise reduction
        if preprocessing_options.get('reduce_noise', True):
            image = cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
            
        # Convert to tensor and move to GPU
        tensor = torch.from_numpy(image).permute(2, 0, 1).float().to(device)
        tensor = tensor / 255.0  # Normalize to [0, 1]
        
        preprocessing_metadata = {
            'original_size': image.shape,
            'target_dpi': target_dpi,
            'scale_factor': scale_factor,
            'device': str(device),
            'tensor_shape': tensor.shape
        }
        
        return tensor, preprocessing_metadata
        
    except Exception as e:
        logger.error(f"OCR preprocessing error: {str(e)}", exc_info=True)
        raise

def split_into_chunks(content: str, chunk_size: int = 1000, 
                     overlap_ratio: float = 0.1,
                     chunking_options: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """
    Intelligent content chunking with semantic boundary preservation.
    
    Args:
        content: Text content to chunk
        chunk_size: Target size for each chunk
        overlap_ratio: Ratio of overlap between chunks
        chunking_options: Additional chunking parameters
        
    Returns:
        List of chunk dictionaries with metadata
    """
    try:
        chunks = []
        options = {
            'respect_sentences': True,
            'respect_paragraphs': True,
            'min_chunk_size': chunk_size // 2,
            'preserve_formatting': True,
            **chunking_options or {}
        }
        
        # Clean and normalize content
        content = content.strip()
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        current_chunk = []
        current_size = 0
        overlap_size = int(chunk_size * overlap_ratio)
        
        for i, paragraph in enumerate(paragraphs):
            sentences = [s.strip() for s in paragraph.split('.') if s.strip()]
            
            for sentence in sentences:
                sentence_size = len(sentence)
                
                if current_size + sentence_size > chunk_size and current_chunk:
                    # Create chunk with metadata
                    chunk_text = ' '.join(current_chunk)
                    chunks.append({
                        'content': chunk_text,
                        'size': len(chunk_text),
                        'metadata': {
                            'start_paragraph': i,
                            'end_paragraph': i,
                            'sentence_count': len(current_chunk),
                            'has_overlap': bool(chunks)
                        }
                    })
                    
                    # Handle overlap for next chunk
                    if options['respect_sentences']:
                        overlap_text = current_chunk[-2:] if len(current_chunk) > 2 else current_chunk[-1:]
                        current_chunk = overlap_text
                        current_size = sum(len(s) for s in overlap_text)
                    else:
                        current_chunk = []
                        current_size = 0
                
                current_chunk.append(sentence)
                current_size += sentence_size
        
        # Handle remaining content
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append({
                'content': chunk_text,
                'size': len(chunk_text),
                'metadata': {
                    'start_paragraph': len(paragraphs) - 1,
                    'end_paragraph': len(paragraphs) - 1,
                    'sentence_count': len(current_chunk),
                    'has_overlap': bool(chunks)
                }
            })
        
        return chunks
        
    except Exception as e:
        logger.error(f"Content chunking error: {str(e)}", exc_info=True)
        raise