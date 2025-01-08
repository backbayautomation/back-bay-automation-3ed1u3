"""
Test suite for vector utility functions used in the AI-powered catalog search system.
Tests vector operations, similarity calculations, batch processing, and edge cases.

External Dependencies:
pytest==7.4.0 - Testing framework and fixtures
numpy==1.24.0 - Vector operations and test data generation
"""

import pytest
import numpy as np
from time import perf_counter
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
    ),
]

NORMALIZATION_TEST_CASES = [
    np.random.rand(VECTOR_DIMENSION) * 100,  # Large magnitude vector
    np.random.rand(VECTOR_DIMENSION) * 1e-5,  # Small magnitude vector
    np.ones(VECTOR_DIMENSION),  # Unit vector
    np.zeros(VECTOR_DIMENSION),  # Zero vector
]

class TestVectorUtils:
    """Test class for vector utility functions with comprehensive test coverage."""

    @pytest.fixture(autouse=True)
    def setup_method(self, request):
        """Setup method for each test."""
        np.random.seed(42)  # Ensure reproducible test data
        self.test_vectors = np.random.rand(100, VECTOR_DIMENSION)
        self.query_vector = np.random.rand(VECTOR_DIMENSION)
        self.test_metadata = {
            "batch_size": 32,
            "similarity_threshold": SIMILARITY_THRESHOLD
        }

    def teardown_method(self, request):
        """Cleanup after each test."""
        del self.test_vectors
        del self.query_vector

    @pytest.mark.utils
    @pytest.mark.vector
    @pytest.mark.parametrize("vectors,expected", SIMILARITY_TEST_CASES)
    def test_calculate_cosine_similarity(self, vectors: Tuple[np.ndarray, np.ndarray], expected: float):
        """Test cosine similarity calculation with various vector pairs."""
        start_time = perf_counter()
        
        # Calculate similarity
        similarity = calculate_cosine_similarity(vectors[0], vectors[1])
        
        # Verify execution time
        assert perf_counter() - start_time < MAX_EXECUTION_TIME
        
        # Verify result
        assert abs(similarity - expected) < NUMERICAL_TOLERANCE

    @pytest.mark.utils
    @pytest.mark.vector
    def test_calculate_cosine_similarity_invalid_input(self):
        """Test cosine similarity calculation with invalid inputs."""
        # Test with invalid dimensions
        with pytest.raises(ValueError):
            calculate_cosine_similarity(
                np.random.rand(VECTOR_DIMENSION + 1),
                np.random.rand(VECTOR_DIMENSION)
            )

        # Test with non-numpy array
        with pytest.raises(ValueError):
            calculate_cosine_similarity(
                [1.0] * VECTOR_DIMENSION,
                np.random.rand(VECTOR_DIMENSION)
            )

    @pytest.mark.utils
    @pytest.mark.vector
    @pytest.mark.parametrize("vector", NORMALIZATION_TEST_CASES)
    def test_normalize_vector(self, vector: np.ndarray):
        """Test vector normalization with various input vectors."""
        start_time = perf_counter()
        
        # Normalize vector
        normalized = normalize_vector(vector)
        
        # Verify execution time
        assert perf_counter() - start_time < MAX_EXECUTION_TIME
        
        # Verify unit length (except for zero vector)
        if np.any(vector):
            assert abs(np.linalg.norm(normalized) - 1.0) < NUMERICAL_TOLERANCE
        else:
            assert np.allclose(normalized, np.zeros_like(vector))

    @pytest.mark.utils
    @pytest.mark.vector
    def test_normalize_vector_invalid_input(self):
        """Test vector normalization with invalid inputs."""
        # Test with wrong dimension
        with pytest.raises(ValueError):
            normalize_vector(np.random.rand(VECTOR_DIMENSION + 1))

        # Test with non-numpy array
        with pytest.raises(ValueError):
            normalize_vector([1.0] * VECTOR_DIMENSION)

    @pytest.mark.utils
    @pytest.mark.vector
    @pytest.mark.slow
    def test_batch_similarity_search(self):
        """Test batch similarity search with performance validation."""
        start_time = perf_counter()
        
        # Perform batch search
        results = batch_similarity_search(self.query_vector, list(self.test_vectors))
        
        # Verify execution time (adjusted for batch size)
        max_time = MAX_EXECUTION_TIME * (len(self.test_vectors) / self.test_metadata["batch_size"])
        assert perf_counter() - start_time < max_time
        
        # Verify results
        assert all(similarity >= SIMILARITY_THRESHOLD for _, similarity in results)
        assert all(idx < len(self.test_vectors) for idx, _ in results)
        
        # Verify sorting
        assert all(results[i][1] >= results[i+1][1] for i in range(len(results)-1))

    @pytest.mark.utils
    @pytest.mark.vector
    def test_batch_similarity_search_edge_cases(self):
        """Test batch similarity search with edge cases."""
        # Test with empty vector list
        assert batch_similarity_search(self.query_vector, []) == []
        
        # Test with single vector
        single_result = batch_similarity_search(
            self.query_vector,
            [np.ones(VECTOR_DIMENSION)]
        )
        assert len(single_result) <= 1
        
        # Test with invalid vector in batch
        with pytest.raises(ValueError):
            batch_similarity_search(
                self.query_vector,
                [np.random.rand(VECTOR_DIMENSION + 1)]
            )

    @pytest.mark.utils
    @pytest.mark.vector
    def test_validate_vector_dimension(self):
        """Test vector dimension validation."""
        # Test valid vector
        assert validate_vector_dimension(np.random.rand(VECTOR_DIMENSION))
        
        # Test invalid dimensions
        assert not validate_vector_dimension(np.random.rand(VECTOR_DIMENSION + 1))
        assert not validate_vector_dimension(np.random.rand(VECTOR_DIMENSION - 1))
        
        # Test invalid shapes
        assert not validate_vector_dimension(np.random.rand(VECTOR_DIMENSION, 1))
        assert not validate_vector_dimension(np.random.rand(1, VECTOR_DIMENSION))
        
        # Test invalid types
        assert not validate_vector_dimension([1.0] * VECTOR_DIMENSION)
        assert not validate_vector_dimension(None)

    @pytest.mark.utils
    @pytest.mark.vector
    def test_numerical_stability(self):
        """Test numerical stability of vector operations."""
        # Test with very large vectors
        large_vector = np.random.rand(VECTOR_DIMENSION) * 1e10
        normalized_large = normalize_vector(large_vector)
        assert np.isfinite(normalized_large).all()
        
        # Test with very small vectors
        small_vector = np.random.rand(VECTOR_DIMENSION) * 1e-10
        normalized_small = normalize_vector(small_vector)
        assert np.isfinite(normalized_small).all()