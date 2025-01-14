"""
Test suite for vector utility functions in the AI-powered catalog search system.
Tests vector operations, similarity calculations, and batch processing with comprehensive coverage.

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
TEST_BATCH_SIZE = 32
TEST_VECTOR_COUNT = 100

# Test vectors with known properties
SIMILARITY_TEST_CASES = [
    # Identical vectors should have similarity 1.0
    (
        (np.ones(VECTOR_DIMENSION), np.ones(VECTOR_DIMENSION)),
        1.0
    ),
    # Orthogonal vectors should have similarity 0.0
    (
        (np.array([1.0] + [0.0] * (VECTOR_DIMENSION-1)),
         np.array([0.0, 1.0] + [0.0] * (VECTOR_DIMENSION-2))),
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
    np.ones(VECTOR_DIMENSION),  # Unit vector
    np.zeros(VECTOR_DIMENSION)  # Zero vector
]

class TestVectorUtils:
    """Test class for vector utility functions with comprehensive test coverage."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup test fixtures with controlled random state."""
        np.random.seed(42)  # Ensure reproducible test data
        self.test_vectors = np.random.rand(TEST_VECTOR_COUNT, VECTOR_DIMENSION)
        self.query_vector = np.random.rand(VECTOR_DIMENSION)
        self.test_metadata = {
            "performance_threshold_ms": 100,
            "memory_threshold_mb": 512
        }

    def teardown_method(self):
        """Cleanup after each test."""
        self.test_vectors = None
        self.query_vector = None

    @pytest.mark.utils
    @pytest.mark.vector
    @pytest.mark.parametrize("vectors,expected", SIMILARITY_TEST_CASES)
    def test_calculate_cosine_similarity(self, vectors: Tuple[np.ndarray, np.ndarray], expected: float):
        """Test cosine similarity calculation with various vector pairs."""
        vector1, vector2 = vectors
        similarity = calculate_cosine_similarity(vector1, vector2)
        assert abs(similarity - expected) < NUMERICAL_TOLERANCE, \
            f"Cosine similarity calculation failed: expected {expected}, got {similarity}"

    @pytest.mark.utils
    @pytest.mark.vector
    def test_calculate_cosine_similarity_invalid_input(self):
        """Test cosine similarity calculation with invalid inputs."""
        # Test with invalid dimensions
        invalid_vector = np.random.rand(VECTOR_DIMENSION + 1)
        with pytest.raises(ValueError):
            calculate_cosine_similarity(invalid_vector, self.query_vector)

        # Test with non-numpy array
        with pytest.raises(ValueError):
            calculate_cosine_similarity([1.0] * VECTOR_DIMENSION, self.query_vector)

    @pytest.mark.utils
    @pytest.mark.vector
    @pytest.mark.parametrize("vector", NORMALIZATION_TEST_CASES)
    def test_normalize_vector(self, vector: np.ndarray):
        """Test vector normalization with various input cases."""
        normalized = normalize_vector(vector)
        
        # Skip magnitude check for zero vector
        if not np.allclose(vector, 0):
            magnitude = np.linalg.norm(normalized)
            assert abs(magnitude - 1.0) < NUMERICAL_TOLERANCE, \
                f"Normalized vector magnitude should be 1.0, got {magnitude}"

        # Verify original vector unchanged
        assert np.array_equal(vector, NORMALIZATION_TEST_CASES[0]), \
            "Original vector should not be modified"

    @pytest.mark.utils
    @pytest.mark.vector
    def test_normalize_vector_invalid_input(self):
        """Test vector normalization with invalid inputs."""
        # Test with wrong dimension
        invalid_vector = np.random.rand(VECTOR_DIMENSION + 1)
        with pytest.raises(ValueError):
            normalize_vector(invalid_vector)

        # Test with non-numpy array
        with pytest.raises(ValueError):
            normalize_vector([1.0] * VECTOR_DIMENSION)

    @pytest.mark.utils
    @pytest.mark.vector
    @pytest.mark.slow
    def test_batch_similarity_search(self):
        """Test batch similarity search functionality and performance."""
        # Generate test vectors with known similarities
        similar_vectors = [self.query_vector * (1 + np.random.rand() * 0.1) 
                         for _ in range(5)]  # 5 similar vectors
        test_vectors = similar_vectors + [np.random.rand(VECTOR_DIMENSION) 
                                        for _ in range(95)]  # 95 random vectors
        
        # Perform batch search
        results = batch_similarity_search(self.query_vector, test_vectors)
        
        # Verify results
        assert len(results) > 0, "Should find at least the similar vectors"
        assert all(sim >= SIMILARITY_THRESHOLD for _, sim in results), \
            "All results should meet similarity threshold"
        assert all(sim1 >= sim2 for (_, sim1), (_, sim2) in zip(results, results[1:])), \
            "Results should be sorted by similarity in descending order"

    @pytest.mark.utils
    @pytest.mark.vector
    def test_validate_vector_dimension(self):
        """Test vector dimension validation."""
        # Test valid vector
        valid_vector = np.random.rand(VECTOR_DIMENSION)
        assert validate_vector_dimension(valid_vector), \
            "Should validate correct dimension vector"

        # Test invalid dimensions
        invalid_vector = np.random.rand(VECTOR_DIMENSION + 1)
        assert not validate_vector_dimension(invalid_vector), \
            "Should reject incorrect dimension vector"

        # Test invalid types
        assert not validate_vector_dimension([1.0] * VECTOR_DIMENSION), \
            "Should reject non-numpy array input"
        assert not validate_vector_dimension(None), \
            "Should reject None input"

    @pytest.mark.utils
    @pytest.mark.vector
    def test_batch_similarity_search_performance(self):
        """Test batch similarity search performance requirements."""
        import time
        
        # Measure execution time
        start_time = time.time()
        batch_similarity_search(self.query_vector, self.test_vectors.tolist())
        execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        assert execution_time < self.test_metadata["performance_threshold_ms"], \
            f"Batch search exceeded performance threshold: {execution_time}ms"

    @pytest.mark.utils
    @pytest.mark.vector
    def test_batch_similarity_search_edge_cases(self):
        """Test batch similarity search with edge cases."""
        # Test empty vector list
        results = batch_similarity_search(self.query_vector, [])
        assert len(results) == 0, "Empty vector list should return empty results"

        # Test single vector
        results = batch_similarity_search(self.query_vector, [self.query_vector])
        assert len(results) == 1 and abs(results[0][1] - 1.0) < NUMERICAL_TOLERANCE, \
            "Identical vector should have similarity 1.0"

        # Test with invalid vectors in batch
        invalid_vectors = [np.random.rand(VECTOR_DIMENSION + 1)]
        results = batch_similarity_search(self.query_vector, invalid_vectors)
        assert len(results) == 0, "Invalid vectors should be skipped"