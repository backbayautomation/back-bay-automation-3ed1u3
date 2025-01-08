"""
FastAPI endpoint module implementing query processing and search functionality.
Provides secure, monitored, and optimized natural language query handling with caching.

Version: 1.0.0
"""

import logging
import time
from typing import Dict, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from opentelemetry import trace
from prometheus_client import Counter, Histogram
from tenacity import retry, stop_after_attempt, wait_exponential

from app.services.ai_service import AIService
from app.services.chat_service import ChatService
from app.services.cache_service import CacheService
from app.schemas.query import QueryCreate, QueryResult, SearchParameters
from app.core.security import verify_token
from app.db.session import get_db
from app.utils.logging import StructuredLogger

# Configure structured logging
logger = StructuredLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix='/queries', tags=['queries'])

# Initialize OpenTelemetry tracer
tracer = trace.get_tracer(__name__)

# Prometheus metrics
QUERY_REQUESTS = Counter('query_requests_total', 'Total number of query requests')
QUERY_ERRORS = Counter('query_errors_total', 'Total number of query errors')
QUERY_LATENCY = Histogram('query_request_latency_seconds', 'Query request latency')
CHAT_SESSIONS = Counter('chat_sessions_total', 'Total number of chat sessions')

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
        background_tasks: FastAPI background tasks
        ai_service: AI service instance
        cache_service: Cache service instance
        db: Database session

    Returns:
        QueryResult: Response containing answer and context

    Raises:
        HTTPException: If request validation or processing fails
    """
    start_time = time.time()
    QUERY_REQUESTS.inc()

    try:
        # Validate authentication and authorization
        token = request.headers.get('Authorization')
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token"
            )

        token_data = verify_token(token.split()[1])
        client_id = token_data.get('client_id')

        # Generate correlation ID
        correlation_id = str(UUID.uuid4())
        logger.info(
            "Processing query request",
            extra={
                'correlation_id': correlation_id,
                'client_id': client_id,
                'query_length': len(query.query_text)
            }
        )

        # Check cache
        cache_key = f"query:{client_id}:{hash(query.query_text)}"
        cached_response = await cache_service.get(cache_key)
        if cached_response:
            logger.info(
                "Cache hit for query",
                extra={'correlation_id': correlation_id}
            )
            return QueryResult(**cached_response)

        # Process query with retry logic
        with tracer.start_span('ai_processing') as span:
            span.set_attribute('client_id', client_id)
            span.set_attribute('query_length', len(query.query_text))

            response = await ai_service.process_query(
                query.query_text,
                query.context or {},
                {
                    'client_id': client_id,
                    'correlation_id': correlation_id,
                    'request_id': query.request_id
                }
            )

        # Cache successful response
        if response and response.get('answer'):
            await cache_service.set(
                cache_key,
                response,
                ttl=3600  # 1 hour cache TTL
            )

        # Record metrics asynchronously
        background_tasks.add_task(
            logger.log_metric,
            'query_processing_time',
            time.time() - start_time,
            {'client_id': client_id}
        )

        logger.info(
            "Query processed successfully",
            extra={
                'correlation_id': correlation_id,
                'processing_time': time.time() - start_time
            }
        )

        return QueryResult(**response)

    except Exception as e:
        QUERY_ERRORS.inc()
        logger.error(
            "Query processing failed",
            extra={
                'error': str(e),
                'correlation_id': correlation_id
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post('/{session_id}/chat', response_model=QueryResult)
@tracer.start_as_current_span('process_chat_query')
async def process_chat_query(
    request: Request,
    session_id: UUID,
    query: QueryCreate,
    background_tasks: BackgroundTasks,
    chat_service: ChatService = Depends()
) -> QueryResult:
    """
    Process chat query within a session with context management.

    Args:
        request: FastAPI request object
        session_id: Chat session identifier
        query: Query request schema
        background_tasks: FastAPI background tasks
        chat_service: Chat service instance

    Returns:
        QueryResult: Response containing answer and session context

    Raises:
        HTTPException: If session validation or processing fails
    """
    start_time = time.time()
    CHAT_SESSIONS.inc()

    try:
        # Validate authentication and session
        token = request.headers.get('Authorization')
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token"
            )

        token_data = verify_token(token.split()[1])
        user_id = token_data.get('user_id')

        # Generate correlation ID
        correlation_id = str(UUID.uuid4())
        logger.info(
            "Processing chat query",
            extra={
                'correlation_id': correlation_id,
                'session_id': str(session_id),
                'user_id': user_id
            }
        )

        # Process chat message
        with tracer.start_span('chat_processing') as span:
            span.set_attribute('session_id', str(session_id))
            span.set_attribute('query_length', len(query.query_text))

            response = await chat_service.process_message(
                session_id,
                query.query_text,
                {
                    'user_id': user_id,
                    'correlation_id': correlation_id,
                    'request_id': query.request_id
                }
            )

        # Record metrics asynchronously
        background_tasks.add_task(
            logger.log_metric,
            'chat_processing_time',
            time.time() - start_time,
            {'session_id': str(session_id)}
        )

        logger.info(
            "Chat query processed successfully",
            extra={
                'correlation_id': correlation_id,
                'processing_time': time.time() - start_time
            }
        )

        return QueryResult(**response)

    except Exception as e:
        QUERY_ERRORS.inc()
        logger.error(
            "Chat query processing failed",
            extra={
                'error': str(e),
                'correlation_id': correlation_id,
                'session_id': str(session_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
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
        user_id = token_data.get('user_id')

        # Generate correlation ID
        correlation_id = str(UUID.uuid4())
        logger.info(
            "Retrieving query history",
            extra={
                'correlation_id': correlation_id,
                'user_id': user_id,
                'limit': limit,
                'offset': offset
            }
        )

        # Fetch paginated history
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

        # Format response
        results = []
        for row in history:
            results.append({
                'id': str(row.id),
                'query_text': row.query_text,
                'created_at': row.created_at.isoformat(),
                'user_email': row.user_email
            })

        logger.info(
            "Query history retrieved successfully",
            extra={
                'correlation_id': correlation_id,
                'result_count': len(results)
            }
        )

        return {
            'results': results,
            'total': await db.scalar(
                "SELECT COUNT(*) FROM queries WHERE user_id = :user_id",
                {'user_id': user_id}
            ),
            'limit': limit,
            'offset': offset
        }

    except Exception as e:
        logger.error(
            "Failed to retrieve query history",
            extra={
                'error': str(e),
                'correlation_id': correlation_id
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )