"""
Service module implementing chat functionality for the AI-powered Product Catalog Search System.
Manages chat sessions, message handling, and integration with AI processing with enhanced
production features including caching, monitoring, and security.

Version: 1.0.0
"""

import logging
from uuid import UUID
from datetime import datetime
from typing import Dict, Optional
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from redis import Redis
from prometheus_client import Counter, Histogram
from opentelemetry import trace
from tenacity import retry, stop_after_attempt, wait_exponential

from ..models.chat_session import ChatSession
from ..models.message import Message
from .ai_service import AIService
from .vector_search import VectorSearchService

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize tracing
tracer = trace.get_tracer(__name__)

# Initialize metrics
CHAT_REQUESTS = Counter('chat_requests_total', 'Total chat requests processed')
CHAT_ERRORS = Counter('chat_errors_total', 'Total chat processing errors')
RESPONSE_TIME = Histogram('chat_response_time_seconds', 'Chat response time in seconds')

# Constants
MAX_HISTORY_MESSAGES = 50
CACHE_TTL = 3600
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_PERIOD = 60

class ChatService:
    """Enhanced service class implementing chat functionality with production-ready features."""

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
        
        # Initialize metrics
        self._request_counter = Counter(
            'chat_service_requests_total',
            'Total requests handled by chat service',
            ['operation']
        )
        self._response_time = Histogram(
            'chat_service_latency_seconds',
            'Chat service operation latency',
            ['operation']
        )
        
        # Initialize tracer
        self._tracer = trace.get_tracer(__name__)
        
        logger.info("Chat service initialized with monitoring and tracing")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def create_session(
        self,
        user_id: UUID,
        title: str,
        metadata: Optional[Dict] = None
    ) -> ChatSession:
        """Create a new chat session with validation and security checks."""
        with self._tracer.start_as_current_span("create_chat_session") as span:
            try:
                # Validate input
                if not title or len(title) > 255:
                    raise ValueError("Invalid title length")

                # Check rate limits
                cache_key = f"rate_limit:create_session:{user_id}"
                if not await self._check_rate_limit(cache_key):
                    raise HTTPException(status_code=429, detail="Rate limit exceeded")

                # Create session with security context
                session = ChatSession(
                    user_id=user_id,
                    title=title,
                    metadata={
                        "context": {},
                        "preferences": {},
                        "stats": {},
                        **(metadata or {})
                    }
                )

                # Add to database with retry mechanism
                self._db.add(session)
                await self._db.flush()
                await self._db.commit()

                # Update metrics
                self._request_counter.labels(operation="create_session").inc()
                
                # Add trace context
                span.set_attribute("session_id", str(session.id))
                span.set_attribute("user_id", str(user_id))

                logger.info(
                    "Chat session created",
                    extra={
                        "session_id": str(session.id),
                        "user_id": str(user_id)
                    }
                )

                return session

            except Exception as e:
                await self._db.rollback()
                CHAT_ERRORS.inc()
                logger.error(
                    f"Session creation failed: {str(e)}",
                    extra={"user_id": str(user_id)},
                    exc_info=True
                )
                raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def process_message(
        self,
        session_id: UUID,
        content: str
    ) -> Dict:
        """Process user message with enhanced error handling and monitoring."""
        with self._tracer.start_as_current_span("process_message") as span:
            with self._response_time.labels(operation="process_message").time():
                try:
                    # Validate input
                    if not content or len(content) > Message.MAX_CONTENT_LENGTH:
                        raise ValueError("Invalid message content")

                    # Check cache
                    cache_key = f"chat:response:{session_id}:{hash(content)}"
                    cached_response = await self._cache.get(cache_key)
                    if cached_response:
                        return cached_response

                    # Add user message to session
                    user_message = Message(
                        chat_session_id=session_id,
                        content=content,
                        role="user",
                        metadata={"timestamp": datetime.utcnow().isoformat()}
                    )
                    self._db.add(user_message)

                    # Get chat history with security context
                    history = await self._get_chat_history(session_id)
                    
                    # Process query with AI service
                    response = await self._ai_service.process_query(
                        content,
                        history,
                        {"session_id": str(session_id)}
                    )

                    # Add AI response to session
                    ai_message = Message(
                        chat_session_id=session_id,
                        content=response["answer"],
                        role="system",
                        metadata={
                            "context": response["context"],
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )
                    self._db.add(ai_message)
                    await self._db.commit()

                    # Update cache
                    result = {
                        "message_id": str(ai_message.id),
                        "content": response["answer"],
                        "context": response["context"],
                        "metadata": response["metadata"]
                    }
                    await self._cache.set(cache_key, result, ttl=CACHE_TTL)

                    # Update metrics
                    CHAT_REQUESTS.inc()
                    span.set_attribute("session_id", str(session_id))
                    
                    logger.info(
                        "Message processed successfully",
                        extra={
                            "session_id": str(session_id),
                            "message_id": str(ai_message.id)
                        }
                    )

                    return result

                except Exception as e:
                    await self._db.rollback()
                    CHAT_ERRORS.inc()
                    logger.error(
                        f"Message processing failed: {str(e)}",
                        extra={"session_id": str(session_id)},
                        exc_info=True
                    )
                    raise

    async def _get_chat_history(self, session_id: UUID) -> str:
        """Retrieve formatted chat history with security filtering."""
        messages = await self._db.query(Message)\
            .filter(Message.chat_session_id == session_id)\
            .order_by(Message.created_at.desc())\
            .limit(MAX_HISTORY_MESSAGES)\
            .all()

        return "\n".join([
            f"{msg.role}: {msg.content}"
            for msg in reversed(messages)
        ])

    async def _check_rate_limit(self, key: str) -> bool:
        """Check rate limiting with Redis."""
        try:
            current = await self._cache.get(key) or 0
            if int(current) >= RATE_LIMIT_REQUESTS:
                return False
            
            await self._cache.set(
                key,
                int(current) + 1,
                ttl=RATE_LIMIT_PERIOD
            )
            return True

        except Exception as e:
            logger.error(f"Rate limit check failed: {str(e)}", exc_info=True)
            return True  # Fail open on rate limit errors