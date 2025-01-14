"""
WebSocket handler implementing real-time chat functionality with enterprise-grade features
including security, monitoring, and reliability for the AI-powered Product Catalog Search System.

Version: 1.0.0
"""

import asyncio
import json
import structlog
from typing import Dict, Optional
from uuid import UUID
from fastapi.websockets import WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Gauge, Histogram  # version: 0.17.1
import opentelemetry.trace  # version: 1.20.0
from tenacity import AsyncCircuitBreaker, wait_exponential  # version: 8.2.0

from .connection_manager import ConnectionManager
from ..services.chat_service import ChatService
from ..core.security import verify_token
from ..utils.metrics import MetricsCollector

# Initialize structured logger
logger = structlog.get_logger(__name__)

# Constants
MESSAGE_TIMEOUT = 30  # Seconds to wait for message processing
MAX_RETRIES = 3      # Maximum retry attempts for message processing
RATE_LIMIT = "100/minute"  # Rate limit per client
BATCH_SIZE = 10      # Message batch size for processing

# Initialize Prometheus metrics
ACTIVE_CONNECTIONS = Gauge("websocket_connections_active", "Number of active WebSocket connections")
MESSAGE_COUNTER = Counter("websocket_messages_total", "Total WebSocket messages processed", ["type"])
PROCESSING_TIME = Histogram("websocket_message_processing_seconds", "Message processing time")
ERROR_COUNTER = Counter("websocket_errors_total", "Total WebSocket errors", ["type"])

@opentelemetry.trace.instrument_class()
class ChatHandler:
    """
    Handles WebSocket chat connections and message processing with enterprise-grade
    security, monitoring, and reliability features.
    """

    def __init__(self, connection_manager: ConnectionManager, chat_service: ChatService):
        """Initialize chat handler with required services and monitoring."""
        self._connection_manager = connection_manager
        self._chat_service = chat_service
        
        # Connection state tracking
        self._connection_states: Dict[str, Dict] = {}
        
        # Message caching for reliability
        self._message_cache: Dict[str, Dict] = {}
        
        # Circuit breaker for reliability
        self._circuit_breaker = AsyncCircuitBreaker(
            failure_threshold=5,
            recovery_timeout=30,
            retry_options=dict(
                wait=wait_exponential(multiplier=1, min=4, max=10),
                stop=lambda _: False
            )
        )

        logger.info("Chat handler initialized successfully")

    @asyncio.coroutine
    @opentelemetry.trace.instrument()
    async def handle_connection(
        self,
        websocket: WebSocket,
        client_id: str,
        session_id: UUID,
        tenant_id: str
    ) -> None:
        """
        Handle new WebSocket connection with security and monitoring.
        
        Args:
            websocket: WebSocket connection instance
            client_id: Client identifier
            session_id: Chat session UUID
            tenant_id: Tenant identifier for isolation
        """
        connection_id = f"{client_id}:{session_id}"
        
        try:
            # Apply rate limiting
            if not await self._connection_manager.check_rate_limit(client_id, RATE_LIMIT):
                await websocket.close(code=1008, reason="Rate limit exceeded")
                ERROR_COUNTER.labels(type="rate_limit").inc()
                return

            # Register new connection
            if not await self._connection_manager.connect(websocket, client_id):
                await websocket.close(code=1013, reason="Connection limit exceeded")
                ERROR_COUNTER.labels(type="connection_limit").inc()
                return

            # Verify chat session exists
            session = await self._chat_service.get_session(session_id)
            if not session:
                await websocket.close(code=1003, reason="Invalid session")
                ERROR_COUNTER.labels(type="invalid_session").inc()
                return

            # Initialize connection state
            self._connection_states[connection_id] = {
                "last_activity": asyncio.get_event_loop().time(),
                "message_count": 0,
                "tenant_id": tenant_id
            }

            ACTIVE_CONNECTIONS.inc()
            logger.info(
                "WebSocket connection established",
                connection_id=connection_id,
                tenant_id=tenant_id
            )

            # Send connection confirmation
            await self._connection_manager.send_personal_message(
                json.dumps({"type": "connected", "session_id": str(session_id)}),
                websocket
            )

            # Message handling loop
            try:
                while True:
                    # Wait for message with timeout
                    message = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=MESSAGE_TIMEOUT
                    )

                    # Process message
                    await self.process_message(
                        websocket,
                        session_id,
                        message,
                        tenant_id
                    )

                    # Update activity timestamp
                    self._connection_states[connection_id]["last_activity"] = \
                        asyncio.get_event_loop().time()
                    self._connection_states[connection_id]["message_count"] += 1

            except asyncio.TimeoutError:
                logger.warning(
                    "WebSocket message timeout",
                    connection_id=connection_id
                )
                ERROR_COUNTER.labels(type="timeout").inc()

            except WebSocketDisconnect:
                logger.info(
                    "WebSocket disconnected normally",
                    connection_id=connection_id
                )

        except Exception as e:
            ERROR_COUNTER.labels(type="connection_error").inc()
            logger.error(
                "WebSocket connection error",
                connection_id=connection_id,
                error=str(e),
                exc_info=True
            )

        finally:
            # Cleanup connection
            await self._connection_manager.disconnect(websocket, client_id)
            self._connection_states.pop(connection_id, None)
            ACTIVE_CONNECTIONS.dec()

    @asyncio.coroutine
    @opentelemetry.trace.instrument()
    async def process_message(
        self,
        websocket: WebSocket,
        session_id: UUID,
        message_content: str,
        tenant_id: str
    ) -> Dict:
        """
        Process incoming chat message with reliability features.
        
        Args:
            websocket: WebSocket connection instance
            session_id: Chat session UUID
            message_content: Message content to process
            tenant_id: Tenant identifier
            
        Returns:
            Dict containing processed message response
        """
        message_id = f"{session_id}:{hash(message_content)}"
        
        try:
            # Validate message format
            try:
                message_data = json.loads(message_content)
                if not isinstance(message_data.get("content"), str):
                    raise ValueError("Invalid message format")
            except (json.JSONDecodeError, ValueError) as e:
                ERROR_COUNTER.labels(type="invalid_message").inc()
                await self._connection_manager.send_personal_message(
                    json.dumps({"type": "error", "message": "Invalid message format"}),
                    websocket
                )
                return

            # Check circuit breaker
            if not self._circuit_breaker.is_closed():
                ERROR_COUNTER.labels(type="circuit_breaker").inc()
                await self._connection_manager.send_personal_message(
                    json.dumps({"type": "error", "message": "Service temporarily unavailable"}),
                    websocket
                )
                return

            # Process message with retry mechanism
            with PROCESSING_TIME.time():
                for attempt in range(MAX_RETRIES):
                    try:
                        # Send typing indicator
                        await self._connection_manager.send_personal_message(
                            json.dumps({"type": "typing"}),
                            websocket
                        )

                        # Process message
                        response = await self._chat_service.process_message(
                            session_id,
                            message_data["content"],
                            {"tenant_id": tenant_id}
                        )

                        # Cache successful response
                        self._message_cache[message_id] = response
                        
                        # Send response
                        await self._connection_manager.send_personal_message(
                            json.dumps({
                                "type": "message",
                                "content": response["content"],
                                "context": response["context"]
                            }),
                            websocket
                        )

                        MESSAGE_COUNTER.labels(type="processed").inc()
                        return response

                    except Exception as e:
                        if attempt == MAX_RETRIES - 1:
                            raise
                        await asyncio.sleep(2 ** attempt)

            logger.info(
                "Message processed successfully",
                message_id=message_id,
                tenant_id=tenant_id
            )

        except Exception as e:
            ERROR_COUNTER.labels(type="processing_error").inc()
            logger.error(
                "Message processing error",
                message_id=message_id,
                tenant_id=tenant_id,
                error=str(e),
                exc_info=True
            )
            await self._connection_manager.send_personal_message(
                json.dumps({
                    "type": "error",
                    "message": "Failed to process message"
                }),
                websocket
            )
            raise

    @opentelemetry.trace.instrument()
    async def health_check(self) -> Dict:
        """
        Perform health check on chat handler.
        
        Returns:
            Dict containing health status information
        """
        try:
            health_data = {
                "status": "healthy",
                "active_connections": len(self._connection_states),
                "circuit_breaker": self._circuit_breaker.is_closed(),
                "cache_size": len(self._message_cache),
                "metrics": {
                    "messages_processed": MESSAGE_COUNTER.labels(type="processed")._value.get(),
                    "errors": ERROR_COUNTER._metrics
                }
            }

            logger.info("Health check completed", health_data=health_data)
            return health_data

        except Exception as e:
            logger.error("Health check failed", error=str(e), exc_info=True)
            return {
                "status": "unhealthy",
                "error": str(e)
            }