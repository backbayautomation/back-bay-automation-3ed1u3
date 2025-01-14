"""
FastAPI endpoint module implementing query processing and search functionality.
Provides secure, monitored, and optimized natural language query handling with
comprehensive error handling and performance tracking.

Version: 1.0.0
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from opentelemetry import trace
from prometheus_client import Counter, Histogram
from tenacity import retry, stop_after_attempt, wait_exponential

from app.schemas.query import QueryCreate, QueryResult, SearchParameters
from app.services.ai_service import AIService
from app.services.chat_service import ChatService
from app.services.cache_service import CacheService
from app.core.security import verify_token
from app.db.session import get_db
from app.utils.logging import StructuredLogger

# Initialize router
router = APIRouter(prefix='/queries', tags=['queries'])

# Initialize logger
logger = StructuredLogger(__name__)

# Initialize tracer
tracer = trace.get_tracer(__name__)

# Initialize metrics
QUERY_REQUESTS = Counter('query_requests_total', 'Total query requests', ['status'])
QUERY_LATENCY = Histogram('query_request_duration_seconds', 'Query request duration')
CACHE_HITS = Counter('query_cache_hits_total', 'Query cache hits')

# Rate limiting constants
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_PERIOD = 3600  # 1 hour

@router.post('/', response_model=QueryResult)
@tracer.start_as_current_span('process_query')
async def process_query(
    request: Request,
    query: QueryCreate,
    background_tasks: BackgroundTasks,
    ai_service: AIService = Depends(),
    cache_service: CacheService = Depends(),
    db: AsyncSession = Depends(get_db)
) -> QueryResult:
    """
    Process natural language query with caching, monitoring, and error handling.
    
    Args:
        request: FastAPI request object
        query: Query request schema
        background_tasks: Background task handler
        ai_service: AI processing service
        cache_service: Cache service
        db: Database session
        
    Returns:
        QueryResult: Response containing answer and metadata
        
    Raises:
        HTTPException: If request validation or processing fails
    """
    with QUERY_LATENCY.time():
        try:
            # Generate correlation ID
            correlation_id = str(uuid.uuid4())
            logger.info(
                "Processing query request",
                extra={
                    'correlation_id': correlation_id,
                    'query_length': len(query.query_text)
                }
            )

            # Validate authentication and authorization
            token = request.headers.get('Authorization')
            if not token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Missing authentication token"
                )
            
            token_data = verify_token(token.split()[1])
            client_id = token_data.get('client_id')

            # Check rate limits
            if not await cache_service.check_rate_limit(
                f"query_limit:{client_id}",
                RATE_LIMIT_REQUESTS,
                RATE_LIMIT_PERIOD
            ):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )

            # Check cache
            cache_key = f"query:{client_id}:{hash(query.query_text)}"
            cached_response = await cache_service.get(cache_key)
            if cached_response:
                CACHE_HITS.inc()
                logger.info(
                    "Cache hit for query",
                    extra={'correlation_id': correlation_id}
                )
                return QueryResult(**cached_response)

            # Process query
            start_time = datetime.utcnow()
            response = await ai_service.process_query(
                query.query_text,
                query.context or {},
                {
                    'client_id': client_id,
                    'correlation_id': correlation_id,
                    'request_id': query.request_id
                }
            )

            # Prepare result
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            result = QueryResult(
                answer=response['response'],
                relevant_chunks=response['context_used'],
                metadata={
                    'model_version': response['metadata'].get('model_version'),
                    'tokens_used': response['metadata'].get('tokens_used'),
                    'processing_steps': response['metadata'].get('processing_steps')
                },
                confidence_score=response['metadata'].get('confidence', 0.0),
                processing_time=processing_time,
                source_documents=response['metadata'].get('source_documents', []),
                telemetry_data={
                    'retrieval_time': response['metadata'].get('retrieval_time'),
                    'generation_time': response['metadata'].get('generation_time'),
                    'cache_hits': response['metadata'].get('cache_hits', 0)
                }
            )

            # Cache result
            background_tasks.add_task(
                cache_service.set,
                cache_key,
                result.model_dump(),
                ttl=3600
            )

            # Record metrics
            QUERY_REQUESTS.labels(status='success').inc()
            logger.info(
                "Query processed successfully",
                extra={
                    'correlation_id': correlation_id,
                    'processing_time': processing_time
                }
            )

            return result

        except HTTPException:
            QUERY_REQUESTS.labels(status='error').inc()
            raise
        except Exception as e:
            QUERY_REQUESTS.labels(status='error').inc()
            logger.error(
                "Query processing failed",
                extra={
                    'correlation_id': correlation_id,
                    'error': str(e)
                }
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process query"
            )

@router.post('/{session_id}/chat', response_model=QueryResult)
@tracer.start_as_current_span('process_chat_query')
async def process_chat_query(
    session_id: uuid.UUID,
    query: QueryCreate,
    background_tasks: BackgroundTasks,
    chat_service: ChatService = Depends(),
    db: AsyncSession = Depends(get_db)
) -> QueryResult:
    """
    Process chat query within a session with context management.
    
    Args:
        session_id: Chat session identifier
        query: Query request schema
        background_tasks: Background task handler
        chat_service: Chat service
        db: Database session
        
    Returns:
        QueryResult: Response containing answer and session context
        
    Raises:
        HTTPException: If session validation or processing fails
    """
    correlation_id = str(uuid.uuid4())
    
    try:
        # Validate session
        session = await chat_service.validate_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found"
            )

        # Process message
        response = await chat_service.process_message(
            session_id,
            query.query_text,
            query.context
        )

        # Prepare result
        result = QueryResult(
            answer=response['content'],
            relevant_chunks=response['context'].get('chunks_used', []),
            metadata={
                'session_id': str(session_id),
                'message_id': response['message_id'],
                'processing_steps': response['metadata'].get('processing_steps', [])
            },
            confidence_score=response['metadata'].get('confidence', 0.0),
            processing_time=response['metadata'].get('processing_time', 0.0),
            telemetry_data=response['metadata'].get('analytics', {})
        )

        # Record metrics
        QUERY_REQUESTS.labels(status='success').inc()
        logger.info(
            "Chat query processed successfully",
            extra={
                'correlation_id': correlation_id,
                'session_id': str(session_id)
            }
        )

        return result

    except HTTPException:
        QUERY_REQUESTS.labels(status='error').inc()
        raise
    except Exception as e:
        QUERY_REQUESTS.labels(status='error').inc()
        logger.error(
            "Chat query processing failed",
            extra={
                'correlation_id': correlation_id,
                'session_id': str(session_id),
                'error': str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat query"
        )

@router.get('/history', response_model=Dict)
@tracer.start_as_current_span('get_query_history')
async def get_query_history(
    request: Request,
    limit: int = 10,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
) -> Dict:
    """
    Retrieve paginated query history with filtering.
    
    Args:
        request: FastAPI request object
        limit: Maximum number of results
        offset: Pagination offset
        db: Database session
        
    Returns:
        Dict containing paginated query results
        
    Raises:
        HTTPException: If history retrieval fails
    """
    try:
        # Validate authentication
        token = request.headers.get('Authorization')
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token"
            )
        
        token_data = verify_token(token.split()[1])
        user_id = token_data.get('sub')

        # Get query history
        history = await db.execute(
            """
            SELECT q.*, u.email as user_email
            FROM queries q
            JOIN users u ON q.user_id = u.id
            WHERE q.user_id = :user_id
            ORDER BY q.created_at DESC
            LIMIT :limit OFFSET :offset
            """,
            {'user_id': user_id, 'limit': limit, 'offset': offset}
        )
        
        # Get total count
        total = await db.execute(
            "SELECT COUNT(*) FROM queries WHERE user_id = :user_id",
            {'user_id': user_id}
        )

        results = []
        for row in history:
            results.append({
                'id': str(row.id),
                'query_text': row.query_text,
                'created_at': row.created_at.isoformat(),
                'user_email': row.user_email,
                'metadata': row.metadata
            })

        return {
            'results': results,
            'total': total.scalar(),
            'limit': limit,
            'offset': offset
        }

    except Exception as e:
        logger.error(
            "Failed to retrieve query history",
            extra={'error': str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve query history"
        )