"""
Core AI service module implementing GPT-4 based natural language processing and response generation.
Provides secure, monitored, and context-aware query processing with multi-tenant isolation.

Version: 1.0.0
"""

import logging
import numpy as np  # version: ^1.24.0
import openai  # version: ^1.3.0
from tenacity import retry, stop_after_attempt, retry_if_exception_type  # version: ^8.2.0
from prometheus_client import Counter, Histogram  # version: ^0.17.0
from typing import Dict, List, Optional
import json
import time

from .vector_search import VectorSearchService
from .cache_service import CacheService
from ..core.config import settings

# Constants
CONTEXT_LENGTH = 8192
MAX_RETRIES = 3
TEMPERATURE = 0.7
CACHE_TTL = 86400  # 24 hours
MAX_TOKENS = 4096

# Configure logging
logger = logging.getLogger(__name__)

# Prometheus metrics
ai_request_counter = Counter('ai_requests_total', 'Total AI requests processed')
ai_error_counter = Counter('ai_errors_total', 'Total AI processing errors')
ai_latency = Histogram('ai_request_latency_seconds', 'AI request latency')

class AIService:
    """
    Service class implementing AI processing and response generation with enhanced security,
    monitoring, and multi-tenant isolation.
    """

    def __init__(self, vector_search_service: VectorSearchService, 
                 cache_service: CacheService, tenant_id: str):
        """
        Initialize AI service with required dependencies and monitoring.

        Args:
            vector_search_service: Vector search service instance
            cache_service: Cache service instance
            tenant_id: Client/tenant identifier
        """
        self._vector_search = vector_search_service
        self._cache = cache_service
        self._tenant_id = tenant_id
        
        # Load OpenAI configuration
        azure_settings = settings.get_azure_settings()
        self._openai_key = azure_settings.get('openai_api_key')
        openai.api_key = self._openai_key
        
        # Configure OpenAI with security headers
        openai.api_type = "azure"
        openai.api_base = azure_settings.get('openai_api_base')
        openai.api_version = "2023-07-01-preview"
        
        # Initialize metrics
        self._metrics = {
            'requests': 0,
            'errors': 0,
            'avg_latency': 0,
            'last_error': None
        }

    @retry(stop=stop_after_attempt(MAX_RETRIES), 
           retry=retry_if_exception_type(Exception))
    @ai_latency.time()
    async def generate_embeddings(self, text: str, metadata: Dict) -> np.ndarray:
        """
        Generate embeddings for input text using GPT-4 with error handling.

        Args:
            text: Input text for embedding generation
            metadata: Additional metadata for tracking

        Returns:
            numpy.ndarray: Generated embedding vector
        """
        try:
            # Validate input
            if not text or not isinstance(text, str):
                raise ValueError("Invalid input text")

            # Add tenant context to metadata
            metadata['tenant_id'] = self._tenant_id
            
            # Generate embeddings with security headers
            response = await openai.Embedding.acreate(
                input=text,
                model="text-embedding-ada-002",
                headers={
                    'X-Tenant-ID': self._tenant_id,
                    'X-Request-ID': metadata.get('request_id')
                }
            )
            
            # Convert to numpy array
            embedding = np.array(response['data'][0]['embedding'], dtype=np.float32)
            
            # Update metrics
            self._metrics['requests'] += 1
            
            logger.debug("Embeddings generated successfully", 
                        extra={'tenant_id': self._tenant_id, 'text_length': len(text)})
            
            return embedding

        except Exception as e:
            self._metrics['errors'] += 1
            self._metrics['last_error'] = str(e)
            ai_error_counter.inc()
            
            logger.error("Embedding generation failed",
                        extra={'tenant_id': self._tenant_id, 'error': str(e)})
            raise

    @ai_latency.time()
    async def process_query(self, query: str, chat_history: str, 
                          user_context: Dict) -> Dict:
        """
        Process natural language query with context management and monitoring.

        Args:
            query: User query text
            chat_history: Previous conversation context
            user_context: User-specific context information

        Returns:
            Dict containing response, context, and metrics
        """
        start_time = time.time()
        ai_request_counter.inc()

        try:
            # Validate inputs
            if not query or not isinstance(query, str):
                raise ValueError("Invalid query input")

            # Check cache with tenant isolation
            cache_key = f"query:{self._tenant_id}:{hash(query)}"
            cached_response = await self._cache.get(cache_key)
            if cached_response:
                return cached_response

            # Generate query embeddings
            query_embedding = await self.generate_embeddings(
                query,
                {'request_type': 'query', 'user_context': user_context}
            )

            # Retrieve relevant context
            context_chunks = await self._vector_search.search(
                query_embedding,
                self._tenant_id,
                top_k=5,
                threshold=0.8
            )

            # Format prompt with context and history
            context_text = "\n".join([chunk['content'] for chunk in context_chunks])
            prompt = self._format_prompt(query, context_text, chat_history)

            # Generate response
            response = await self.generate_response(
                prompt,
                context_chunks,
                {'user_id': user_context.get('user_id')}
            )

            # Prepare result with metrics
            result = {
                'response': response,
                'context': context_chunks,
                'metrics': {
                    'processing_time': time.time() - start_time,
                    'context_chunks': len(context_chunks),
                    'token_count': len(query.split())
                }
            }

            # Cache result
            await self._cache.set(cache_key, result, ttl=CACHE_TTL)

            logger.info("Query processed successfully",
                       extra={'tenant_id': self._tenant_id, 
                             'query_length': len(query),
                             'context_chunks': len(context_chunks)})

            return result

        except Exception as e:
            self._metrics['errors'] += 1
            ai_error_counter.inc()
            
            logger.error("Query processing failed",
                        extra={'tenant_id': self._tenant_id,
                              'error': str(e),
                              'query': query})
            raise

    @retry(stop=stop_after_attempt(MAX_RETRIES),
           retry=retry_if_exception_type(Exception))
    @ai_latency.time()
    async def generate_response(self, prompt: str, context: List[Dict],
                              security_context: Dict) -> str:
        """
        Generate response using GPT-4 with enhanced security and monitoring.

        Args:
            prompt: Formatted prompt text
            context: Retrieved context chunks
            security_context: Security and user context information

        Returns:
            str: Generated response text
        """
        try:
            # Validate security context
            if not security_context.get('user_id'):
                raise ValueError("Missing user context")

            # Format system message with context
            messages = [
                {"role": "system", "content": "You are an AI assistant helping with technical product information."},
                {"role": "user", "content": prompt}
            ]

            # Add security headers
            headers = {
                'X-Tenant-ID': self._tenant_id,
                'X-User-ID': security_context['user_id'],
                'X-Request-ID': str(time.time())
            }

            # Generate completion
            response = await openai.ChatCompletion.acreate(
                model="gpt-4",
                messages=messages,
                temperature=TEMPERATURE,
                max_tokens=MAX_TOKENS,
                headers=headers
            )

            # Extract and validate response
            generated_text = response.choices[0].message.content
            if not generated_text:
                raise ValueError("Empty response from GPT-4")

            # Update metrics
            self._metrics['requests'] += 1

            logger.debug("Response generated successfully",
                        extra={'tenant_id': self._tenant_id,
                              'prompt_length': len(prompt),
                              'response_length': len(generated_text)})

            return generated_text

        except Exception as e:
            self._metrics['errors'] += 1
            ai_error_counter.inc()
            
            logger.error("Response generation failed",
                        extra={'tenant_id': self._tenant_id,
                              'error': str(e)})
            raise

    async def health_check(self) -> Dict:
        """
        Perform health check of AI service components.

        Returns:
            Dict containing health status and metrics
        """
        try:
            # Check OpenAI API
            await openai.Model.alist()

            # Check vector search
            vector_health = await self._vector_search.health_check()

            # Check cache
            cache_health = await self._cache.get_stats()

            health_status = {
                'status': 'healthy',
                'openai_api': True,
                'vector_search': vector_health,
                'cache': cache_health,
                'metrics': self._metrics,
                'timestamp': time.time()
            }

            logger.info("Health check completed",
                       extra={'tenant_id': self._tenant_id,
                             'health_status': health_status})

            return health_status

        except Exception as e:
            logger.error("Health check failed",
                        extra={'tenant_id': self._tenant_id,
                              'error': str(e)})
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': time.time()
            }

    def _format_prompt(self, query: str, context: str, history: str) -> str:
        """
        Format prompt with query, context and chat history.

        Args:
            query: User query
            context: Retrieved context
            history: Chat history

        Returns:
            str: Formatted prompt
        """
        return f"""Context information is below.
---------------------
{context}
---------------------
Chat history:
{history}

Given the context information and chat history above, please answer the following query:
{query}"""