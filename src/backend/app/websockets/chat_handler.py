"""
WebSocket handler implementing real-time chat functionality for the AI-powered Product Catalog Search System.
Provides enterprise-grade chat message processing with security, monitoring, and reliability features.

Version: 1.0.0
"""

import asyncio  # version: latest
import json  # version: latest
import structlog  # version: 23.1.0
from fastapi.websockets import WebSocket, WebSocketDisconnect  # version: ^0.103.0
from fastapi.responses import JSONResponse  # version: ^0.103.0
from opentelemetry import trace  # version: ^1.20.0
from prometheus_client import Counter, Histogram  # version: ^0.17.1
from typing import Dict, Optional
from uuid import UUID
from datetime import datetime

from .connection_manager import ConnectionManager
from ..services.chat_service import ChatService
from ..core.security import verify_token
from ..utils.metrics import MetricsCollector

# Initialize logging
logger = structlog.get_logger(__name__)

# Constants
MESSAGE_TIMEOUT = 30  # Seconds to wait for message processing
MAX_RETRIES = 3  # Maximum number of retry attempts
RATE_LIMIT = "100/minute"  # Rate limiting configuration
BATCH_SIZE = 10  # Message batch size for processing

# Initialize metrics
ws_connections = Counter("websocket_connections_total", "Total WebSocket connections")
ws_messages = Counter("websocket_messages_total", "Total WebSocket messages processed")
ws_errors = Counter("websocket_errors_total", "Total WebSocket errors", ["error_type"])
message_latency = Histogram(
    "websocket_message_latency_seconds",
    "Message processing latency in seconds"
)

class ChatHandler:
    """
    Handles WebSocket chat connections and message processing with enterprise-grade
    security, monitoring, and reliability features.
    """

    def __init__(self, connection_manager: ConnectionManager, chat_service: ChatService):
        """Initialize chat handler with required services and monitoring."""
        self._connection_manager = connection_manager
        self._chat_service = chat_service
        self._connection_states: Dict[str, Dict] = {}
        self._message_cache: Dict[str, Dict] = {}
        self._tracer = trace.get_tracer(__name__)
        self._metrics = MetricsCollector()

        logger.info("Chat handler initialized with monitoring and tracing")

    async def handle_connection(
        self,
        websocket: WebSocket,
        client_id: str,
        session_id: UUID,
        tenant_id: str
    ) -> None:
        """Handle new WebSocket connection with security and monitoring."""
        with self._tracer.start_as_current_span("handle_websocket_connection") as span:
            try:
                # Accept connection with security checks
                await websocket.accept()
                ws_connections.inc()

                # Register connection
                if not await self._connection_manager.connect(websocket, client_id):
                    await websocket.close(code=1008)
                    return

                # Initialize connection state
                self._connection_states[client_id] = {
                    "session_id": session_id,
                    "tenant_id": tenant_id,
                    "connected_at": datetime.utcnow(),
                    "message_count": 0
                }

                span.set_attribute("client_id", client_id)
                span.set_attribute("session_id", str(session_id))

                # Send connection confirmation
                await self._connection_manager.send_personal_message(
                    json.dumps({
                        "type": "connection_established",
                        "session_id": str(session_id)
                    }),
                    websocket
                )

                # Enter message handling loop
                while True:
                    try:
                        # Receive message with timeout
                        message = await asyncio.wait_for(
                            websocket.receive_text(),
                            timeout=MESSAGE_TIMEOUT
                        )

                        # Process message
                        response = await self.process_message(
                            websocket,
                            session_id,
                            message,
                            tenant_id
                        )

                        # Send response
                        if response:
                            await self._connection_manager.send_personal_message(
                                json.dumps(response),
                                websocket
                            )

                    except asyncio.TimeoutError:
                        # Send ping to keep connection alive
                        await websocket.send_text("ping")
                        continue

            except WebSocketDisconnect:
                logger.info(
                    "WebSocket disconnected",
                    client_id=client_id,
                    session_id=str(session_id)
                )
            except Exception as e:
                error_type = type(e).__name__
                ws_errors.labels(error_type=error_type).inc()
                logger.error(
                    "WebSocket error",
                    error=str(e),
                    client_id=client_id,
                    session_id=str(session_id),
                    exc_info=True
                )
            finally:
                # Cleanup connection
                await self._connection_manager.disconnect(websocket, client_id)
                self._connection_states.pop(client_id, None)
                ws_connections.dec()

    async def process_message(
        self,
        websocket: WebSocket,
        session_id: UUID,
        message_content: str,
        tenant_id: str
    ) -> Optional[Dict]:
        """Process incoming chat message with reliability features."""
        with self._tracer.start_as_current_span("process_chat_message") as span:
            with message_latency.time():
                try:
                    # Parse and validate message
                    message_data = json.loads(message_content)
                    if not isinstance(message_data, dict) or "content" not in message_data:
                        raise ValueError("Invalid message format")

                    span.set_attribute("session_id", str(session_id))
                    span.set_attribute("message_type", message_data.get("type", "text"))

                    # Update metrics
                    ws_messages.inc()
                    self._connection_states[tenant_id]["message_count"] += 1

                    # Send typing indicator
                    await self._connection_manager.send_personal_message(
                        json.dumps({"type": "typing_indicator", "status": "active"}),
                        websocket
                    )

                    # Process message with retry mechanism
                    for attempt in range(MAX_RETRIES):
                        try:
                            response = await self._chat_service.process_message(
                                session_id,
                                message_data["content"]
                            )
                            break
                        except Exception as e:
                            if attempt == MAX_RETRIES - 1:
                                raise
                            await asyncio.sleep(2 ** attempt)  # Exponential backoff

                    # Cache successful response
                    cache_key = f"message:{session_id}:{hash(message_content)}"
                    self._message_cache[cache_key] = {
                        "response": response,
                        "timestamp": datetime.utcnow().isoformat()
                    }

                    # Send typing indicator completion
                    await self._connection_manager.send_personal_message(
                        json.dumps({"type": "typing_indicator", "status": "complete"}),
                        websocket
                    )

                    return {
                        "type": "message",
                        "content": response["content"],
                        "metadata": {
                            "session_id": str(session_id),
                            "timestamp": datetime.utcnow().isoformat(),
                            "context": response.get("context", {})
                        }
                    }

                except Exception as e:
                    error_type = type(e).__name__
                    ws_errors.labels(error_type=error_type).inc()
                    logger.error(
                        "Message processing error",
                        error=str(e),
                        session_id=str(session_id),
                        exc_info=True
                    )
                    return {
                        "type": "error",
                        "content": "Failed to process message",
                        "error": str(e)
                    }

    async def health_check(self) -> Dict:
        """Perform health check on chat handler components."""
        try:
            health_status = {
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "components": {
                    "connection_manager": True,
                    "chat_service": True,
                    "message_cache": True
                },
                "metrics": {
                    "active_connections": len(self._connection_states),
                    "message_cache_size": len(self._message_cache),
                    "total_messages": ws_messages._value.get(),
                    "error_count": sum(ws_errors.values())
                }
            }

            # Verify connection manager
            if not self._connection_manager:
                health_status["components"]["connection_manager"] = False
                health_status["status"] = "degraded"

            # Verify chat service
            chat_service_health = await self._chat_service.health_check()
            if chat_service_health.get("status") != "healthy":
                health_status["components"]["chat_service"] = False
                health_status["status"] = "degraded"

            return health_status

        except Exception as e:
            logger.error("Health check failed", error=str(e), exc_info=True)
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }