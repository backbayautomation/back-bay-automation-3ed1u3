"""
Test suite for vector utility functions in the AI-powered catalog search system.
Tests vector operations, similarity calculations, and batch processing with comprehensive
validation of functionality, performance, and edge cases.

External Dependencies:
pytest==7.4.0 - Testing framework and fixtures
numpy==1.24.0 - Vector operations and test data generation
"""

import pytest
import numpy as np
from typing import List, Tuple
from app.utils.vector_utils import (
    calculate_cosine_similarity,
    normalize_vector,
    batch_similarity_search,
    validate_vector_dimension,
    VECTOR_DIMENSION,
    SIMILARITY_THRESHOLD
)

# Test constants
NUMERICAL_TOLERANCE = 1e-7
MAX_EXECUTION_TIME = 0.1  # seconds

# Test vectors and expected results
SIMILARITY_TEST_CASES = [
    # Identical vectors should have similarity 1.0
    (
        (np.ones(VECTOR_DIMENSION), np.ones(VECTOR_DIMENSION)),
        1.0
    ),
    # Orthogonal vectors should have similarity 0.0
    (
        (np.array([1.0] + [0.0] * (VECTOR_DIMENSION-1)),
         np.array([0.0] + [1.0] + [0.0] * (VECTOR_DIMENSION-2))),
        0.0
    ),
    # Opposite vectors should have similarity -1.0
    (
        (np.ones(VECTOR_DIMENSION), -np.ones(VECTOR_DIMENSION)),
        -1.0
    )
]

NORMALIZATION_TEST_CASES = [
    np.random.rand(VECTOR_DIMENSION) * 100,  # Large magnitude
    np.random.rand(VECTOR_DIMENSION) * 1e-5,  # Small magnitude
    np.zeros(VECTOR_DIMENSION),  # Zero vector
    np.ones(VECTOR_DIMENSION)  # Unit vector
]

@pytest.mark.utils
@pytest.mark.vector
class TestVectorUtils:
    """Test class for vector utility functions with comprehensive validation."""
    
    def setup_method(self, method):
        """Setup test data before each test method."""
        np.random.seed(42)  # Ensure reproducible test data
        
        # Generate test vectors
        self.test_vectors = np.random.rand(100, VECTOR_DIMENSION)
        self.query_vector = np.random.rand(VECTOR_DIMENSION)
        
        # Test metadata
        self.test_metadata = {
            'batch_size': 32,
            'threshold': SIMILARITY_THRESHOLD,
            'dimension': VECTOR_DIMENSION
        }

    def teardown_method(self, method):
        """Cleanup after each test method."""
        self.test_vectors = None
        self.query_vector = None
        self.test_metadata = None

    @pytest.mark.parametrize('vectors,expected', SIMILARITY_TEST_CASES)
    def test_calculate_cosine_similarity(self, vectors: Tuple[np.ndarray, np.ndarray], expected: float):
        """Test cosine similarity calculation with various vector pairs."""
        vector1, vector2 = vectors
        
        # Calculate similarity
        similarity = calculate_cosine_similarity(vector1, vector2)
        
        # Verify result
        assert abs(similarity - expected) < NUMERICAL_TOLERANCE, \
            f"Expected similarity {expected}, got {similarity}"
        
        # Verify symmetry
        reverse_similarity = calculate_cosine_similarity(vector2, vector1)
        assert abs(similarity - reverse_similarity) < NUMERICAL_TOLERANCE, \
            "Cosine similarity should be symmetric"

    @pytest.mark.parametrize('vector', NORMALIZATION_TEST_CASES)
    def test_normalize_vector(self, vector: np.ndarray):
        """Test vector normalization with various input cases."""
        # Store original vector for comparison
        original = vector.copy()
        
        # Normalize vector
        normalized = normalize_vector(vector)
        
        if np.any(vector):  # Non-zero vector
            # Verify unit length
            norm = np.linalg.norm(normalized)
            assert abs(norm - 1.0) < NUMERICAL_TOLERANCE, \
                f"Normalized vector magnitude should be 1.0, got {norm}"
            
            # Verify direction preserved
            if np.linalg.norm(original) > 1e-8:
                cosine = np.dot(normalized, original) / np.linalg.norm(original)
                assert cosine > 0, "Normalization should preserve vector direction"
        else:  # Zero vector
            assert np.allclose(normalized, np.zeros_like(vector)), \
                "Zero vector should normalize to zero vector"

    @pytest.mark.slow
    def test_batch_similarity_search(self):
        """Test batch similarity search with performance validation."""
        # Generate test dataset
        num_vectors = 1000
        test_vectors = [np.random.rand(VECTOR_DIMENSION) for _ in range(num_vectors)]
        query = np.random.rand(VECTOR_DIMENSION)
        
        # Perform batch search
        with pytest.raises(ValueError):
            batch_similarity_search(query, [])  # Test empty list handling
        
        results = batch_similarity_search(query, test_vectors)
        
        # Verify results
        assert len(results) <= num_vectors, "Should not return more results than input vectors"
        assert all(0 <= sim <= 1.0 for _, sim in results), "Similarity scores should be in [0,1]"
        assert all(sim >= SIMILARITY_THRESHOLD for _, sim in results), \
            "All results should meet threshold requirement"
        
        # Verify sorting
        similarities = [sim for _, sim in results]
        assert all(similarities[i] >= similarities[i+1] for i in range(len(similarities)-1)), \
            "Results should be sorted by similarity in descending order"

    def test_validate_vector_dimension(self):
        """Test vector dimension validation with various cases."""
        # Valid cases
        assert validate_vector_dimension(np.zeros(VECTOR_DIMENSION)), \
            "Should accept vector with correct dimension"
        
        # Invalid cases
        assert not validate_vector_dimension(np.zeros(VECTOR_DIMENSION + 1)), \
            "Should reject vector with wrong dimension"
        assert not validate_vector_dimension(np.zeros((VECTOR_DIMENSION, 1))), \
            "Should reject 2D array"
        assert not validate_vector_dimension([0] * VECTOR_DIMENSION), \
            "Should reject non-numpy array"
        assert not validate_vector_dimension(None), \
            "Should reject None input"
        
        # Edge cases
        with pytest.raises(ValueError):
            normalize_vector(np.zeros(VECTOR_DIMENSION + 1))

    @pytest.mark.parametrize('batch_size', [1, 16, 32, 64])
    def test_batch_processing_performance(self, batch_size):
        """Test batch processing performance with various batch sizes."""
        import time
        
        # Generate test data
        vectors = [np.random.rand(VECTOR_DIMENSION) for _ in range(batch_size)]
        query = np.random.rand(VECTOR_DIMENSION)
        
        # Measure execution time
        start_time = time.time()
        results = batch_similarity_search(query, vectors)
        execution_time = time.time() - start_time
        
        # Verify performance
        assert execution_time < MAX_EXECUTION_TIME, \
            f"Batch processing took {execution_time:.3f}s, exceeding limit of {MAX_EXECUTION_TIME}s"
        
        # Verify batch size handling
        assert len(results) <= batch_size, \
            f"Number of results ({len(results)}) exceeds batch size ({batch_size})"