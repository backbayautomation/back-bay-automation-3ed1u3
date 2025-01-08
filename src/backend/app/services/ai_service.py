"""
Core AI service module implementing GPT-4 based natural language processing and response generation.
Provides secure, monitored, and context-aware query processing with multi-tenant isolation.

Version: 1.0.0
"""

import logging
import openai  # version: 1.3.0
import numpy as np  # version: 1.24.0
from typing import Dict, List, Optional
from datetime import datetime
from tenacity import retry, stop_after_attempt, retry_if_exception_type  # version: 8.2.0
from prometheus_client import Counter, Histogram  # version: 0.17.0

from .vector_search import VectorSearchService
from .cache_service import CacheService
from ..core.config import settings

# Constants
CONTEXT_LENGTH = 8192  # Maximum context window size
MAX_RETRIES = 3  # Maximum number of API call retries
TEMPERATURE = 0.7  # GPT-4 temperature setting
CACHE_TTL = 86400  # Cache TTL in seconds (24 hours)
MAX_TOKENS = 4096  # Maximum response tokens

# Configure logging
logger = logging.getLogger(__name__)

# Initialize metrics
ai_request_counter = Counter('ai_requests_total', 'Total AI requests processed')
ai_error_counter = Counter('ai_errors_total', 'Total AI processing errors')
ai_latency = Histogram('ai_request_latency_seconds', 'AI request latency')

class AIService:
    """Service class implementing AI processing and response generation with enhanced security and monitoring."""

    def __init__(
        self,
        vector_search_service: VectorSearchService,
        cache_service: CacheService,
        tenant_id: str
    ):
        """Initialize AI service with required dependencies and monitoring."""
        self._vector_search = vector_search_service
        self._cache = cache_service
        self._tenant_id = tenant_id
        
        # Load OpenAI configuration from settings
        azure_settings = settings.get_azure_settings()
        self._openai_key = azure_settings.get('openai_api_key')
        
        # Configure OpenAI client
        openai.api_key = self._openai_key
        openai.api_type = "azure"
        openai.api_version = "2023-07-01-preview"
        openai.api_base = azure_settings.get('openai_api_base')
        
        # Initialize metrics
        self._metrics = {
            'requests': 0,
            'errors': 0,
            'cache_hits': 0,
            'avg_latency': 0.0,
            'last_error': None
        }
        
        logger.info(
            "AI service initialized",
            extra={
                'tenant_id': tenant_id,
                'vector_search_enabled': bool(vector_search_service),
                'cache_enabled': bool(cache_service)
            }
        )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        retry=retry_if_exception_type(Exception)
    )
    @ai_latency.time()
    async def generate_embeddings(self, text: str, metadata: Dict) -> np.ndarray:
        """Generate embeddings for input text using GPT-4 with error handling."""
        try:
            # Validate input
            if not text or not isinstance(text, str):
                raise ValueError("Invalid input text")

            # Add tenant context to request
            metadata['tenant_id'] = self._tenant_id
            
            # Generate embeddings
            response = await openai.Embedding.acreate(
                input=text,
                model="text-embedding-ada-002",
                user=self._tenant_id
            )
            
            # Convert to numpy array
            embedding = np.array(response['data'][0]['embedding'], dtype=np.float32)
            
            # Update metrics
            ai_request_counter.inc()
            
            return embedding

        except Exception as e:
            ai_error_counter.inc()
            self._metrics['errors'] += 1
            self._metrics['last_error'] = str(e)
            logger.error(
                f"Embedding generation error: {str(e)}",
                extra={'tenant_id': self._tenant_id, 'metadata': metadata},
                exc_info=True
            )
            raise

    @ai_latency.time()
    async def process_query(
        self,
        query: str,
        chat_history: str,
        user_context: Dict
    ) -> Dict:
        """Process natural language query with context management and monitoring."""
        try:
            # Validate inputs
            if not query or not isinstance(query, str):
                raise ValueError("Invalid query")

            # Check cache
            cache_key = f"query:{self._tenant_id}:{hash(query)}"
            cached_response = await self._cache.get(cache_key)
            if cached_response:
                self._metrics['cache_hits'] += 1
                return cached_response

            # Generate query embeddings
            query_embedding = await self.generate_embeddings(
                query,
                {'type': 'query', 'user_context': user_context}
            )

            # Retrieve relevant context
            context_chunks = await self._vector_search.search(
                query_embedding,
                self._tenant_id,
                top_k=5
            )

            # Format prompt with context
            context_text = "\n".join([chunk['content'] for chunk in context_chunks])
            prompt = self._format_prompt(query, context_text, chat_history)

            # Generate response
            response = await self.generate_response(
                prompt,
                context_chunks,
                {'user_context': user_context}
            )

            # Prepare result
            result = {
                'answer': response,
                'context': context_chunks,
                'metadata': {
                    'timestamp': datetime.utcnow().isoformat(),
                    'model': 'gpt-4',
                    'similarity_scores': [chunk['similarity_score'] for chunk in context_chunks]
                }
            }

            # Cache result
            await self._cache.set(cache_key, result, ttl=CACHE_TTL)

            # Update metrics
            self._metrics['requests'] += 1
            
            return result

        except Exception as e:
            ai_error_counter.inc()
            self._metrics['errors'] += 1
            self._metrics['last_error'] = str(e)
            logger.error(
                f"Query processing error: {str(e)}",
                extra={'tenant_id': self._tenant_id, 'query': query},
                exc_info=True
            )
            raise

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        retry=retry_if_exception_type(Exception)
    )
    @ai_latency.time()
    async def generate_response(
        self,
        prompt: str,
        context: List[Dict],
        security_context: Dict
    ) -> str:
        """Generate response using GPT-4 with enhanced security and monitoring."""
        try:
            # Validate security context
            if not security_context or 'user_context' not in security_context:
                raise ValueError("Invalid security context")

            # Format system message with context
            system_message = (
                "You are an AI assistant helping with technical product information. "
                "Use the provided context to answer questions accurately and concisely. "
                "If you're unsure, acknowledge the uncertainty."
            )

            # Call GPT-4 API with security headers
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": prompt}
                ],
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                user=self._tenant_id,
                headers={'X-Tenant-ID': self._tenant_id}
            )

            # Extract and validate response
            generated_text = response.choices[0].message.content
            if not generated_text:
                raise ValueError("Empty response from GPT-4")

            # Update metrics
            ai_request_counter.inc()

            return generated_text

        except Exception as e:
            ai_error_counter.inc()
            self._metrics['errors'] += 1
            self._metrics['last_error'] = str(e)
            logger.error(
                f"Response generation error: {str(e)}",
                extra={'tenant_id': self._tenant_id},
                exc_info=True
            )
            raise

    def _format_prompt(self, query: str, context: str, chat_history: str) -> str:
        """Format prompt with context and chat history."""
        return (
            f"Context:\n{context}\n\n"
            f"Chat History:\n{chat_history}\n\n"
            f"Question: {query}\n\n"
            "Answer:"
        )

    async def health_check(self) -> Dict:
        """Perform health check of AI service components."""
        try:
            health_status = {
                'status': 'healthy',
                'components': {
                    'openai': True,
                    'vector_search': True,
                    'cache': True
                },
                'metrics': self._metrics,
                'timestamp': datetime.utcnow().isoformat()
            }

            # Test OpenAI connection
            await openai.Embedding.acreate(
                input="test",
                model="text-embedding-ada-002",
                user=self._tenant_id
            )

            # Test vector search
            await self._vector_search.search(
                np.zeros(1536),
                self._tenant_id,
                top_k=1
            )

            # Test cache
            await self._cache.get("health_check")

            return health_status

        except Exception as e:
            logger.error(f"Health check failed: {str(e)}", exc_info=True)
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }