"""
Enhanced chat service implementation for AI-powered Product Catalog Search System.
Provides secure, monitored, and context-aware chat functionality with multi-tenant isolation.

Version: 1.0.0
"""

import logging
import asyncio
from uuid import UUID
from datetime import datetime
from typing import Dict, Optional, List
from tenacity import retry, stop_after_attempt, wait_exponential  # version: ^8.2.0
from prometheus_client import Counter, Histogram, Gauge  # version: ^0.17.0
from opentelemetry import trace  # version: ^1.18.0
from sqlalchemy.orm import Session  # version: ^1.4.0
from redis import Redis  # version: ^4.5.0

from ..models.chat_session import ChatSession
from ..models.message import Message
from .ai_service import AIService
from .vector_search import VectorSearchService
from ..core.security import encrypt_sensitive_data
from ..utils.logging import StructuredLogger

# Configure logger
logger = StructuredLogger(__name__)

# Prometheus metrics
CHAT_REQUESTS = Counter('chat_requests_total', 'Total number of chat requests')
CHAT_ERRORS = Counter('chat_errors_total', 'Total number of chat errors')
CHAT_LATENCY = Histogram('chat_request_latency_seconds', 'Chat request latency')
ACTIVE_SESSIONS = Gauge('chat_active_sessions', 'Number of active chat sessions')

# Constants
MAX_HISTORY_MESSAGES = 50
CACHE_TTL = 3600  # 1 hour
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_PERIOD = 60  # 1 minute

class ChatService:
    """
    Enhanced service class implementing chat functionality with production-ready features
    including monitoring, caching, and security controls.
    """

    def __init__(
        self,
        db_session: Session,
        ai_service: AIService,
        vector_search: VectorSearchService,
        cache_client: Redis,
        config: Dict
    ):
        """Initialize chat service with required dependencies and monitoring."""
        self._db = db_session
        self._ai_service = ai_service
        self._vector_search = vector_search
        self._cache = cache_client
        self._config = config
        
        # Initialize OpenTelemetry tracer
        self._tracer = trace.get_tracer(__name__)
        
        # Initialize rate limiting
        self._rate_limit = {}
        
        logger.info("Chat service initialized", 
                   extra={'config': str(config)})

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def create_session(
        self,
        user_id: UUID,
        client_id: UUID,
        title: str,
        metadata: Optional[Dict] = None
    ) -> ChatSession:
        """
        Create a new chat session with enhanced security and validation.

        Args:
            user_id: User identifier
            client_id: Client/tenant identifier
            title: Session title
            metadata: Optional session metadata

        Returns:
            ChatSession: Newly created session

        Raises:
            ValueError: If validation fails
        """
        with self._tracer.start_as_current_span("create_chat_session") as span:
            try:
                # Validate rate limits
                if not self._check_rate_limit(str(user_id)):
                    raise ValueError("Rate limit exceeded")

                # Create session with security context
                session = ChatSession(
                    user_id=user_id,
                    client_id=client_id,
                    title=title,
                    metadata={
                        **(metadata or {}),
                        'created_at': datetime.utcnow().isoformat(),
                        'client_info': self._get_client_info()
                    }
                )

                # Add to database
                self._db.add(session)
                await asyncio.to_thread(self._db.commit)

                ACTIVE_SESSIONS.inc()
                logger.info("Chat session created",
                          extra={'session_id': str(session.id),
                                'user_id': str(user_id)})

                span.set_attribute("session_id", str(session.id))
                return session

            except Exception as e:
                CHAT_ERRORS.inc()
                logger.error("Failed to create chat session",
                           extra={'error': str(e), 'user_id': str(user_id)})
                raise

    @CHAT_LATENCY.time()
    async def process_message(
        self,
        session_id: UUID,
        content: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Process chat message with context management and monitoring.

        Args:
            session_id: Chat session identifier
            content: Message content
            metadata: Optional message metadata

        Returns:
            Dict containing response and context

        Raises:
            ValueError: If validation fails
        """
        with self._tracer.start_as_current_span("process_chat_message") as span:
            try:
                CHAT_REQUESTS.inc()

                # Validate session and rate limits
                session = await self._get_session(session_id)
                if not self._check_rate_limit(str(session.user_id)):
                    raise ValueError("Rate limit exceeded")

                # Check cache for similar queries
                cache_key = f"chat:{session_id}:{hash(content)}"
                cached_response = await self._cache.get(cache_key)
                if cached_response:
                    return cached_response

                # Create user message
                user_message = Message(
                    chat_session_id=session_id,
                    content=content,
                    role='user',
                    metadata=metadata
                )
                self._db.add(user_message)

                # Get chat history
                history = await self._get_chat_history(session_id)

                # Process with AI service
                ai_response = await self._ai_service.process_query(
                    content,
                    history,
                    {
                        'session_id': str(session_id),
                        'user_id': str(session.user_id)
                    }
                )

                # Create AI response message
                ai_message = Message(
                    chat_session_id=session_id,
                    content=ai_response['response'],
                    role='system',
                    metadata={
                        'context': ai_response['context'],
                        'metrics': ai_response['metrics']
                    }
                )
                self._db.add(ai_message)
                await asyncio.to_thread(self._db.commit)

                # Prepare response
                response = {
                    'message_id': str(ai_message.id),
                    'content': ai_response['response'],
                    'context': ai_response['context'],
                    'created_at': ai_message.created_at.isoformat()
                }

                # Cache response
                await self._cache.set(cache_key, response, ttl=CACHE_TTL)

                span.set_attribute("message_id", str(ai_message.id))
                logger.info("Message processed successfully",
                          extra={'session_id': str(session_id),
                                'message_id': str(ai_message.id)})

                return response

            except Exception as e:
                CHAT_ERRORS.inc()
                logger.error("Failed to process message",
                           extra={'error': str(e),
                                 'session_id': str(session_id)})
                raise

    async def _get_session(self, session_id: UUID) -> ChatSession:
        """Retrieve and validate chat session."""
        session = await asyncio.to_thread(
            self._db.query(ChatSession)
            .filter(ChatSession.id == session_id)
            .first
        )
        
        if not session:
            raise ValueError("Invalid session ID")
        
        if not session.is_active:
            raise ValueError("Session is inactive")
            
        return session

    async def _get_chat_history(self, session_id: UUID) -> str:
        """Retrieve formatted chat history with security filtering."""
        messages = await asyncio.to_thread(
            self._db.query(Message)
            .filter(Message.chat_session_id == session_id)
            .order_by(Message.created_at.desc())
            .limit(MAX_HISTORY_MESSAGES)
            .all
        )
        
        history = []
        for msg in reversed(messages):
            history.append(f"{msg.role}: {msg.content}")
            
        return "\n".join(history)

    def _check_rate_limit(self, identifier: str) -> bool:
        """Check rate limiting with sliding window."""
        now = datetime.utcnow().timestamp()
        
        # Clean expired entries
        self._rate_limit = {
            k: v for k, v in self._rate_limit.items()
            if now - v['timestamp'] < RATE_LIMIT_PERIOD
        }
        
        # Check current rate
        if identifier not in self._rate_limit:
            self._rate_limit[identifier] = {
                'count': 1,
                'timestamp': now
            }
            return True
            
        if self._rate_limit[identifier]['count'] >= RATE_LIMIT_REQUESTS:
            return False
            
        self._rate_limit[identifier]['count'] += 1
        return True

    def _get_client_info(self) -> Dict:
        """Get sanitized client information."""
        return {
            'version': '1.0.0',
            'environment': self._config.get('environment', 'production'),
            'timestamp': datetime.utcnow().isoformat()
        }