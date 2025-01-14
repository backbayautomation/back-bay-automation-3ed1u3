"""
Enhanced chat service implementation for the AI-powered Product Catalog Search System.
Provides secure, monitored, and context-aware chat functionality with multi-tenant isolation.

Version: 1.0.0
"""

import logging
from uuid import UUID
from datetime import datetime
from typing import Dict, Optional, List
from tenacity import retry, stop_after_attempt, wait_exponential  # version: ^8.2.0
from prometheus_client import Counter, Histogram  # version: ^0.16.0
from opentelemetry import trace  # version: ^1.18.0
from sqlalchemy.orm import Session
from redis import Redis

from ..models.chat_session import ChatSession
from ..models.message import Message
from .ai_service import AIService
from .vector_search import VectorSearchService
from ..core.security import encrypt_sensitive_data
from ..utils.logging import StructuredLogger

# Initialize logger
logger = StructuredLogger(__name__)

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Initialize Prometheus metrics
CHAT_REQUESTS = Counter('chat_requests_total', 'Total chat requests', ['tenant_id', 'status'])
CHAT_LATENCY = Histogram('chat_request_duration_seconds', 'Chat request duration')
MESSAGE_COUNT = Counter('chat_messages_total', 'Total chat messages', ['tenant_id', 'role'])
CACHE_HITS = Counter('chat_cache_hits_total', 'Chat cache hits', ['tenant_id'])

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
        """
        Initialize chat service with required dependencies and monitoring.
        
        Args:
            db_session: Database session
            ai_service: AI processing service
            vector_search: Vector search service
            cache_client: Redis cache client
            config: Service configuration
        """
        self._db = db_session
        self._ai_service = ai_service
        self._vector_search = vector_search
        self._cache = cache_client
        self._config = config
        
        # Initialize metrics tracking
        self._metrics = {
            'requests': 0,
            'errors': 0,
            'cache_hits': 0,
            'start_time': datetime.utcnow()
        }
        
        logger.info("Chat service initialized successfully")

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
        """
        Create new chat session with enhanced security and validation.
        
        Args:
            user_id: User identifier
            title: Session title
            metadata: Optional session metadata
            
        Returns:
            ChatSession: Created session instance
            
        Raises:
            ValueError: If validation fails
        """
        with tracer.start_as_current_span("create_chat_session") as span:
            try:
                # Validate inputs
                if not title or len(title) > 255:
                    raise ValueError("Invalid title length")
                
                # Initialize metadata with defaults
                session_metadata = {
                    'context': {},
                    'preferences': {},
                    'analytics': {
                        'created_at': datetime.utcnow().isoformat(),
                        'client_info': metadata.get('client_info', {}) if metadata else {}
                    }
                }
                
                if metadata:
                    # Encrypt sensitive metadata
                    if 'sensitive' in metadata:
                        session_metadata['encrypted_data'] = encrypt_sensitive_data(
                            str(metadata['sensitive'])
                        )
                    session_metadata.update(metadata)
                
                # Create session
                session = ChatSession(
                    user_id=user_id,
                    title=title,
                    metadata=session_metadata
                )
                
                self._db.add(session)
                await self._db.commit()
                
                # Update metrics
                CHAT_REQUESTS.labels(
                    tenant_id=str(session.client_id),
                    status='created'
                ).inc()
                
                span.set_attribute("session_id", str(session.id))
                logger.info(
                    "Chat session created",
                    extra={
                        'session_id': str(session.id),
                        'user_id': str(user_id)
                    }
                )
                
                return session
                
            except Exception as e:
                await self._db.rollback()
                CHAT_REQUESTS.labels(
                    tenant_id='unknown',
                    status='error'
                ).inc()
                logger.error(
                    "Failed to create chat session",
                    extra={'error': str(e)}
                )
                raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def process_message(
        self,
        session_id: UUID,
        content: str,
        context: Optional[Dict] = None
    ) -> Dict:
        """
        Process chat message with enhanced error handling and monitoring.
        
        Args:
            session_id: Chat session identifier
            content: Message content
            context: Optional processing context
            
        Returns:
            Dict containing response and context
            
        Raises:
            ValueError: If validation fails
        """
        with tracer.start_as_current_span("process_message") as span:
            with CHAT_LATENCY.time():
                try:
                    # Validate session and content
                    session = await self._db.query(ChatSession).get(session_id)
                    if not session:
                        raise ValueError("Invalid session ID")
                    
                    if not content or len(content) > Message.MAX_CONTENT_LENGTH:
                        raise ValueError("Invalid message content")
                    
                    # Check cache for similar queries
                    cache_key = f"chat:response:{session_id}:{hash(content)}"
                    cached_response = await self._cache.get(cache_key)
                    if cached_response:
                        CACHE_HITS.labels(tenant_id=str(session.client_id)).inc()
                        return cached_response
                    
                    # Create user message
                    user_message = Message(
                        chat_session_id=session_id,
                        content=content,
                        role='user',
                        metadata={
                            'context': context or {},
                            'analytics': {
                                'timestamp': datetime.utcnow().isoformat()
                            }
                        }
                    )
                    self._db.add(user_message)
                    
                    # Get chat history for context
                    history = await self._get_chat_history(session_id)
                    
                    # Process query with AI service
                    ai_response = await self._ai_service.process_query(
                        content,
                        history,
                        {
                            'session_id': str(session_id),
                            'tenant_id': str(session.client_id)
                        }
                    )
                    
                    # Create AI response message
                    ai_message = Message(
                        chat_session_id=session_id,
                        content=ai_response['response'],
                        role='system',
                        metadata={
                            'context': {
                                'chunks_used': ai_response['context_used']
                            },
                            'analytics': {
                                'processing_time': ai_response['processing_time'],
                                'timestamp': datetime.utcnow().isoformat()
                            }
                        }
                    )
                    self._db.add(ai_message)
                    
                    # Update session activity
                    session.update_activity()
                    await self._db.commit()
                    
                    # Update metrics
                    MESSAGE_COUNT.labels(
                        tenant_id=str(session.client_id),
                        role='user'
                    ).inc()
                    MESSAGE_COUNT.labels(
                        tenant_id=str(session.client_id),
                        role='system'
                    ).inc()
                    
                    # Prepare response
                    response = {
                        'message_id': str(ai_message.id),
                        'content': ai_message.content,
                        'context': ai_message.metadata['context'],
                        'timestamp': ai_message.created_at.isoformat()
                    }
                    
                    # Cache response
                    await self._cache.set(cache_key, response, ttl=3600)
                    
                    span.set_attribute("session_id", str(session_id))
                    logger.info(
                        "Message processed successfully",
                        extra={
                            'session_id': str(session_id),
                            'message_id': str(ai_message.id)
                        }
                    )
                    
                    return response
                    
                except Exception as e:
                    await self._db.rollback()
                    CHAT_REQUESTS.labels(
                        tenant_id='unknown',
                        status='error'
                    ).inc()
                    logger.error(
                        "Failed to process message",
                        extra={
                            'session_id': str(session_id),
                            'error': str(e)
                        }
                    )
                    raise

    async def _get_chat_history(self, session_id: UUID) -> str:
        """
        Retrieve formatted chat history for context.
        
        Args:
            session_id: Chat session identifier
            
        Returns:
            str: Formatted chat history
        """
        messages = await self._db.query(Message).filter(
            Message.chat_session_id == session_id
        ).order_by(
            Message.created_at.desc()
        ).limit(10).all()
        
        history = []
        for msg in reversed(messages):
            history.append(f"{msg.role}: {msg.content}")
        
        return "\n".join(history)

    async def get_session_stats(self, session_id: UUID) -> Dict:
        """
        Get detailed session statistics.
        
        Args:
            session_id: Chat session identifier
            
        Returns:
            Dict containing session statistics
        """
        try:
            session = await self._db.query(ChatSession).get(session_id)
            if not session:
                raise ValueError("Invalid session ID")
            
            message_count = await self._db.query(Message).filter(
                Message.chat_session_id == session_id
            ).count()
            
            return {
                'session_id': str(session_id),
                'message_count': message_count,
                'created_at': session.created_at.isoformat(),
                'last_activity': session.last_activity_at.isoformat(),
                'status': session.status
            }
            
        except Exception as e:
            logger.error(
                "Failed to get session stats",
                extra={
                    'session_id': str(session_id),
                    'error': str(e)
                }
            )
            raise