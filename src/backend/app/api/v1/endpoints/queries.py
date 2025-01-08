"""
FastAPI endpoint module implementing query processing and search functionality.
Provides secure, monitored, and optimized natural language query handling with
comprehensive error handling and performance optimization.

Version: 1.0.0
"""

import logging
from uuid import UUID
from typing import Optional, Dict, Any
from datetime import datetime

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
from app.constants import RATE_LIMIT_REQUESTS, RATE_LIMIT_PERIOD

# Initialize router
router = APIRouter(prefix="/queries", tags=["queries"])

# Configure logging
logger = logging.getLogger(__name__)

# Initialize tracing
tracer = trace.get_tracer(__name__)

# Initialize metrics
QUERY_REQUESTS = Counter('query_requests_total', 'Total query requests processed')
QUERY_ERRORS = Counter('query_errors_total', 'Total query processing errors')
QUERY_LATENCY = Histogram('query_latency_seconds', 'Query processing latency')
CACHE_HITS = Counter('query_cache_hits_total', 'Query cache hits')

@router.post("/", response_model=QueryResult)
@tracer.start_as_current_span("process_query")
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
        query: Query request data
        background_tasks: Background task manager
        ai_service: AI processing service
        cache_service: Cache service
        db: Database session
        
    Returns:
        QueryResult: Processed query response with relevant information
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = datetime.utcnow()
    correlation_id = request.headers.get("X-Correlation-ID", str(UUID.uuid4()))
    
    try:
        # Validate authentication and authorization
        token = request.headers.get("Authorization")
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token"
            )
        
        token_data = verify_token(token.split(" ")[1])
        client_id = token_data.get("client_id")
        
        # Check rate limits
        rate_key = f"rate_limit:query:{client_id}"
        if not await cache_service.check_rate_limit(rate_key, RATE_LIMIT_REQUESTS, RATE_LIMIT_PERIOD):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )
        
        # Validate query parameters
        if not query.query_text or len(query.query_text) > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid query length"
            )
        
        # Check cache
        cache_key = f"query:{client_id}:{hash(query.query_text)}"
        cached_response = await cache_service.get(cache_key)
        if cached_response:
            CACHE_HITS.inc()
            logger.info(
                "Cache hit for query",
                extra={
                    "correlation_id": correlation_id,
                    "client_id": client_id,
                    "cache_key": cache_key
                }
            )
            return QueryResult(**cached_response)
        
        # Process query with retry logic
        with QUERY_LATENCY.time():
            response = await ai_service.process_query(
                query.query_text,
                query.context or {},
                {
                    "client_id": client_id,
                    "correlation_id": correlation_id
                }
            )
        
        # Format response
        result = QueryResult(
            answer=response["answer"],
            relevant_chunks=response["context"],
            metadata=response["metadata"],
            confidence_score=response["metadata"].get("confidence", 0.0),
            processing_time=(datetime.utcnow() - start_time).total_seconds(),
            source_documents=response["metadata"].get("source_documents", []),
            telemetry_data={
                "request_id": correlation_id,
                "timestamp": datetime.utcnow().isoformat(),
                "cache_hit": False,
                "vector_search_time": response["metadata"].get("vector_search_time", 0.0)
            }
        )
        
        # Cache response
        background_tasks.add_task(
            cache_service.set,
            cache_key,
            result.model_dump(),
            ttl=3600
        )
        
        # Update metrics
        QUERY_REQUESTS.inc()
        
        logger.info(
            "Query processed successfully",
            extra={
                "correlation_id": correlation_id,
                "client_id": client_id,
                "processing_time": result.processing_time
            }
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        QUERY_ERRORS.inc()
        logger.error(
            f"Query processing failed: {str(e)}",
            extra={"correlation_id": correlation_id},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Query processing failed"
        )

@router.post("/{session_id}/chat", response_model=QueryResult)
@tracer.start_as_current_span("process_chat_query")
async def process_chat_query(
    request: Request,
    session_id: UUID,
    query: QueryCreate,
    background_tasks: BackgroundTasks,
    chat_service: ChatService = Depends(),
    db: AsyncSession = Depends(get_db)
) -> QueryResult:
    """
    Process chat query within a session with context management.
    
    Args:
        request: FastAPI request object
        session_id: Chat session ID
        query: Query request data
        background_tasks: Background task manager
        chat_service: Chat service
        db: Database session
        
    Returns:
        QueryResult: Processed chat query response
        
    Raises:
        HTTPException: For various error conditions
    """
    start_time = datetime.utcnow()
    correlation_id = request.headers.get("X-Correlation-ID", str(UUID.uuid4()))
    
    try:
        # Validate session and authorization
        token = request.headers.get("Authorization")
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token"
            )
            
        token_data = verify_token(token.split(" ")[1])
        user_id = token_data.get("sub")
        
        # Validate session access
        if not await chat_service.validate_session(session_id, user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid session access"
            )
        
        # Process message
        with QUERY_LATENCY.time():
            response = await chat_service.process_message(
                session_id,
                query.query_text,
                {
                    "user_id": user_id,
                    "correlation_id": correlation_id
                }
            )
        
        # Format response
        result = QueryResult(
            answer=response["content"],
            relevant_chunks=response["context"],
            metadata=response["metadata"],
            confidence_score=response["metadata"].get("confidence", 0.0),
            processing_time=(datetime.utcnow() - start_time).total_seconds(),
            source_documents=response["metadata"].get("source_documents", []),
            telemetry_data={
                "request_id": correlation_id,
                "session_id": str(session_id),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        # Update metrics
        QUERY_REQUESTS.inc()
        
        logger.info(
            "Chat query processed successfully",
            extra={
                "correlation_id": correlation_id,
                "session_id": str(session_id),
                "processing_time": result.processing_time
            }
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        QUERY_ERRORS.inc()
        logger.error(
            f"Chat query processing failed: {str(e)}",
            extra={
                "correlation_id": correlation_id,
                "session_id": str(session_id)
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chat query processing failed"
        )

@router.get("/history", response_model=Dict[str, Any])
@tracer.start_as_current_span("get_query_history")
async def get_query_history(
    request: Request,
    limit: int = 10,
    offset: int = 0,
    filters: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieve paginated query history with filtering.
    
    Args:
        request: FastAPI request object
        limit: Maximum number of results
        offset: Pagination offset
        filters: Optional query filters
        db: Database session
        
    Returns:
        Dict containing paginated query history
        
    Raises:
        HTTPException: For various error conditions
    """
    correlation_id = request.headers.get("X-Correlation-ID", str(UUID.uuid4()))
    
    try:
        # Validate authentication and authorization
        token = request.headers.get("Authorization")
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authentication token"
            )
            
        token_data = verify_token(token.split(" ")[1])
        user_id = token_data.get("sub")
        
        # Validate pagination parameters
        if limit < 1 or limit > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid limit parameter"
            )
            
        if offset < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid offset parameter"
            )
        
        # Query history with filtering
        query = db.query(QueryResult).filter(QueryResult.user_id == user_id)
        
        if filters:
            for key, value in filters.items():
                if hasattr(QueryResult, key):
                    query = query.filter(getattr(QueryResult, key) == value)
        
        # Get total count
        total = await query.count()
        
        # Apply pagination
        results = await query.offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "results": [result.model_dump() for result in results]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to retrieve query history: {str(e)}",
            extra={"correlation_id": correlation_id},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve query history"
        )