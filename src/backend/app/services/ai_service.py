"""
Core AI service module implementing GPT-4 based natural language processing and response generation.
Provides secure, monitored, and context-aware query processing with multi-tenant isolation.

Version: 1.0.0
"""

import logging  # version: latest
import openai   # version: ^1.3.0
import numpy as np  # version: ^1.24.0
from tenacity import retry, stop_after_attempt, retry_if_exception_type  # version: ^8.2.0
from typing import Dict, List, Optional
from datetime import datetime
from prometheus_client import Counter, Histogram  # version: ^0.17.0

from .vector_search import VectorSearchService
from .cache_service import CacheService
from ..core.config import settings

# Initialize logger
logger = logging.getLogger(__name__)

# Global constants
CONTEXT_LENGTH = 8192  # Maximum context window size
MAX_RETRIES = 3       # Maximum retry attempts for API calls
TEMPERATURE = 0.7     # GPT-4 temperature setting
CACHE_TTL = 86400    # Cache TTL in seconds (24 hours)
MAX_TOKENS = 4096    # Maximum response tokens

# Initialize Prometheus metrics
ai_request_counter = Counter('ai_requests_total', 'Total AI requests processed')
ai_error_counter = Counter('ai_errors_total', 'Total AI processing errors')
ai_latency = Histogram('ai_request_latency_seconds', 'AI request latency')

class AIService:
    """Service class implementing AI processing and response generation with enhanced security and monitoring."""

    def __init__(self, vector_search_service: VectorSearchService, cache_service: CacheService, tenant_id: str):
        """
        Initialize AI service with required dependencies and monitoring.
        
        Args:
            vector_search_service: Vector search service instance
            cache_service: Cache service instance
            tenant_id: Tenant identifier for isolation
        """
        self._vector_search = vector_search_service
        self._cache = cache_service
        self._tenant_id = tenant_id
        
        # Initialize OpenAI client with security headers
        self._openai_key = settings.get_azure_settings().get('openai_api_key')
        openai.api_key = self._openai_key
        
        # Initialize metrics tracking
        self._metrics = {
            'requests': 0,
            'errors': 0,
            'cache_hits': 0,
            'start_time': datetime.now().timestamp()
        }
        
        logger.info(
            "AI service initialized",
            extra={'tenant_id': tenant_id}
        )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        retry=retry_if_exception_type(Exception)
    )
    @ai_latency.time()
    async def generate_embeddings(self, text: str, metadata: Dict) -> np.ndarray:
        """
        Generate embeddings for input text using GPT-4 with error handling.
        
        Args:
            text: Input text for embedding generation
            metadata: Additional context metadata
            
        Returns:
            numpy.ndarray: Generated embedding vector
            
        Raises:
            Exception: If embedding generation fails
        """
        try:
            # Apply tenant isolation
            if not metadata.get('tenant_id') == self._tenant_id:
                raise ValueError("Invalid tenant context")
            
            # Generate embeddings with security headers
            response = await openai.Embedding.acreate(
                input=text,
                model="text-embedding-ada-002",
                user=f"tenant_{self._tenant_id}"
            )
            
            # Convert to numpy array
            embedding = np.array(response['data'][0]['embedding'], dtype=np.float32)
            
            logger.debug(
                "Embeddings generated successfully",
                extra={
                    'tenant_id': self._tenant_id,
                    'text_length': len(text),
                    'embedding_dim': embedding.shape[0]
                }
            )
            
            return embedding
            
        except Exception as e:
            ai_error_counter.inc()
            logger.error(
                "Embedding generation failed",
                extra={
                    'tenant_id': self._tenant_id,
                    'error': str(e)
                }
            )
            raise

    @ai_latency.time()
    async def process_query(self, query: str, chat_history: str, user_context: Dict) -> Dict:
        """
        Process natural language query with context management and monitoring.
        
        Args:
            query: User query text
            chat_history: Previous conversation context
            user_context: User and session context
            
        Returns:
            Dict containing response, context, and metrics
        """
        ai_request_counter.inc()
        start_time = datetime.now()
        
        try:
            # Validate tenant context
            if user_context.get('tenant_id') != self._tenant_id:
                raise ValueError("Invalid tenant context")
            
            # Check cache
            cache_key = f"query:{self._tenant_id}:{hash(query)}"
            cached_response = await self._cache.get(cache_key)
            if cached_response:
                self._metrics['cache_hits'] += 1
                return cached_response
            
            # Generate query embeddings
            query_embedding = await self.generate_embeddings(
                query,
                {'tenant_id': self._tenant_id}
            )
            
            # Retrieve relevant context
            context_chunks = await self._vector_search.search(
                query_embedding,
                self._tenant_id
            )
            
            # Format prompt with context
            context_text = "\n".join([
                chunk['content'] for chunk in context_chunks
            ])
            
            prompt = f"""Context: {context_text[:CONTEXT_LENGTH]}
            
            Chat History: {chat_history[-1000:] if chat_history else 'No previous context'}
            
            User Query: {query}
            
            Please provide a detailed and accurate response based on the given context."""
            
            # Generate response
            response = await self.generate_response(
                prompt,
                context_chunks,
                user_context
            )
            
            # Prepare result with metrics
            result = {
                'response': response,
                'context_used': [c['chunk_id'] for c in context_chunks],
                'processing_time': (datetime.now() - start_time).total_seconds(),
                'cache_hit': False
            }
            
            # Cache result
            await self._cache.set(cache_key, result, CACHE_TTL)
            
            self._metrics['requests'] += 1
            logger.info(
                "Query processed successfully",
                extra={
                    'tenant_id': self._tenant_id,
                    'query_length': len(query),
                    'response_length': len(response)
                }
            )
            
            return result
            
        except Exception as e:
            self._metrics['errors'] += 1
            ai_error_counter.inc()
            logger.error(
                "Query processing failed",
                extra={
                    'tenant_id': self._tenant_id,
                    'error': str(e),
                    'query': query
                }
            )
            raise

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        retry=retry_if_exception_type(Exception)
    )
    @ai_latency.time()
    async def generate_response(self, prompt: str, context: List[Dict], security_context: Dict) -> str:
        """
        Generate response using GPT-4 with enhanced security and monitoring.
        
        Args:
            prompt: Formatted prompt text
            context: Retrieved context chunks
            security_context: Security and user context
            
        Returns:
            str: Generated response text
        """
        try:
            # Validate security context
            if security_context.get('tenant_id') != self._tenant_id:
                raise ValueError("Invalid security context")
            
            # Format system prompt
            system_prompt = f"""You are an AI assistant for the {settings.PROJECT_NAME}.
            Provide accurate responses based on the given context.
            Only use information from the provided context."""
            
            # Call GPT-4 with security headers
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                user=f"tenant_{self._tenant_id}",
                headers={
                    'X-Tenant-ID': self._tenant_id,
                    'X-Request-ID': security_context.get('request_id')
                }
            )
            
            generated_text = response['choices'][0]['message']['content']
            
            logger.debug(
                "Response generated successfully",
                extra={
                    'tenant_id': self._tenant_id,
                    'prompt_length': len(prompt),
                    'response_length': len(generated_text)
                }
            )
            
            return generated_text
            
        except Exception as e:
            ai_error_counter.inc()
            logger.error(
                "Response generation failed",
                extra={
                    'tenant_id': self._tenant_id,
                    'error': str(e)
                }
            )
            raise

    async def health_check(self) -> Dict:
        """
        Perform health check of AI service components.
        
        Returns:
            Dict containing health status and metrics
        """
        try:
            # Check OpenAI API
            await openai.Embedding.acreate(
                input="health check",
                model="text-embedding-ada-002",
                user=f"tenant_{self._tenant_id}"
            )
            
            # Check vector search
            vector_health = await self._vector_search.health_check()
            
            # Check cache
            cache_health = await self._cache.get_stats()
            
            return {
                'status': 'healthy',
                'openai_api': 'connected',
                'vector_search': vector_health,
                'cache': cache_health,
                'metrics': {
                    'requests': self._metrics['requests'],
                    'errors': self._metrics['errors'],
                    'cache_hits': self._metrics['cache_hits'],
                    'uptime': datetime.now().timestamp() - self._metrics['start_time']
                }
            }
            
        except Exception as e:
            logger.error(
                "Health check failed",
                extra={
                    'tenant_id': self._tenant_id,
                    'error': str(e)
                }
            )
            return {
                'status': 'unhealthy',
                'error': str(e)
            }