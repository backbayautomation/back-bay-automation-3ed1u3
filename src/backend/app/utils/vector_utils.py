"""
Vector operations utility module for AI-powered catalog search system.
Provides optimized functions for vector manipulation, normalization, and similarity search.

External Dependencies:
numpy==1.24.0 - High-performance vector operations and numerical computations
logging - Comprehensive logging for error tracking and performance monitoring
"""

import numpy as np
import logging
from typing import List, Tuple

# Configure module-level logger
logger = logging.getLogger(__name__)

# Global constants
VECTOR_DIMENSION = 1536  # Dimension size for vector embeddings
BATCH_SIZE = 32  # Batch size for efficient processing
SIMILARITY_THRESHOLD = 0.8  # Minimum similarity score threshold
EPSILON = 1e-8  # Small constant for numerical stability

def validate_vector_dimension(vector: np.ndarray) -> bool:
    """
    Validates vector dimensionality with comprehensive type checking and error logging.
    
    Args:
        vector (np.ndarray): Input vector to validate
        
    Returns:
        bool: True if vector has correct dimension, False otherwise
    """
    logger.debug(f"Validating vector dimension. Input shape: {getattr(vector, 'shape', 'No shape')}")
    
    try:
        if not isinstance(vector, np.ndarray):
            logger.error(f"Invalid input type. Expected numpy.ndarray, got {type(vector)}")
            return False
            
        if vector.ndim != 1:
            logger.error(f"Invalid vector dimensions. Expected 1-D array, got {vector.ndim}-D")
            return False
            
        if vector.shape[0] != VECTOR_DIMENSION:
            logger.error(f"Invalid vector length. Expected {VECTOR_DIMENSION}, got {vector.shape[0]}")
            return False
            
        logger.debug("Vector dimension validation successful")
        return True
        
    except Exception as e:
        logger.error(f"Unexpected error during vector validation: {str(e)}")
        return False

def normalize_vector(vector: np.ndarray) -> np.ndarray:
    """
    Normalizes a vector to unit length with robust error handling and zero magnitude protection.
    
    Args:
        vector (np.ndarray): Input vector to normalize
        
    Returns:
        np.ndarray: Normalized vector with unit length
        
    Raises:
        ValueError: If vector validation fails
    """
    logger.debug("Attempting vector normalization")
    
    if not validate_vector_dimension(vector):
        error_msg = "Vector validation failed during normalization"
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    try:
        magnitude = np.linalg.norm(vector)
        
        if magnitude < EPSILON:
            logger.warning("Near-zero magnitude vector encountered during normalization")
            return np.zeros_like(vector)
            
        normalized = vector / magnitude
        
        # Verify normalization result
        if not np.isfinite(normalized).all():
            logger.error("Normalization produced invalid values")
            raise ValueError("Invalid normalization result")
            
        logger.debug("Vector normalization successful")
        return normalized
        
    except Exception as e:
        logger.error(f"Error during vector normalization: {str(e)}")
        raise

def calculate_cosine_similarity(vector1: np.ndarray, vector2: np.ndarray) -> float:
    """
    Calculates the cosine similarity between two vectors using optimized numpy operations.
    
    Args:
        vector1 (np.ndarray): First input vector
        vector2 (np.ndarray): Second input vector
        
    Returns:
        float: Cosine similarity score between -1 and 1
        
    Raises:
        ValueError: If vector validation fails
    """
    logger.debug(f"Calculating cosine similarity between vectors of shapes {vector1.shape} and {vector2.shape}")
    
    try:
        # Validate both vectors
        if not all(validate_vector_dimension(v) for v in [vector1, vector2]):
            error_msg = "Vector validation failed during similarity calculation"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Normalize vectors
        norm1 = normalize_vector(vector1)
        norm2 = normalize_vector(vector2)
        
        # Calculate dot product
        similarity = np.dot(norm1, norm2)
        
        # Ensure numerical stability
        similarity = np.clip(similarity, -1.0, 1.0)
        
        logger.debug(f"Cosine similarity calculation successful: {similarity}")
        return float(similarity)
        
    except Exception as e:
        logger.error(f"Error during cosine similarity calculation: {str(e)}")
        raise

def batch_similarity_search(query_vector: np.ndarray, vector_list: List[np.ndarray]) -> List[Tuple[int, float]]:
    """
    Performs memory-efficient batch similarity search between query vector and multiple vectors.
    
    Args:
        query_vector (np.ndarray): Query vector to compare against
        vector_list (List[np.ndarray]): List of vectors to search through
        
    Returns:
        List[Tuple[int, float]]: Sorted list of (index, similarity_score) tuples above threshold
        
    Raises:
        ValueError: If vector validation fails or input list is empty
    """
    logger.debug(f"Starting batch similarity search with {len(vector_list)} vectors")
    
    if not vector_list:
        error_msg = "Empty vector list provided for batch search"
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    try:
        # Validate query vector
        if not validate_vector_dimension(query_vector):
            error_msg = "Invalid query vector dimension"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Normalize query vector once
        normalized_query = normalize_vector(query_vector)
        results = []
        
        # Process in batches
        for i in range(0, len(vector_list), BATCH_SIZE):
            batch = vector_list[i:i + BATCH_SIZE]
            logger.debug(f"Processing batch {i//BATCH_SIZE + 1}")
            
            for j, vector in enumerate(batch):
                try:
                    if validate_vector_dimension(vector):
                        similarity = calculate_cosine_similarity(normalized_query, vector)
                        if similarity >= SIMILARITY_THRESHOLD:
                            results.append((i + j, similarity))
                except Exception as e:
                    logger.warning(f"Skipping vector {i + j} due to error: {str(e)}")
                    continue
        
        # Sort results by similarity score in descending order
        results.sort(key=lambda x: x[1], reverse=True)
        
        logger.debug(f"Batch similarity search completed. Found {len(results)} matches above threshold")
        return results
        
    except Exception as e:
        logger.error(f"Error during batch similarity search: {str(e)}")
        raise