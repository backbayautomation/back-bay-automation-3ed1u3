"""
WebSocket handler implementing real-time chat functionality for the AI-powered Product Catalog Search System.
Provides secure, monitored, and reliable real-time communication with multi-tenant isolation.

Version: 1.0.0
"""

import asyncio
import json
import structlog  # version: ^23.1.0
from fastapi.websockets import WebSocket, WebSocketDisconnect  # version: ^0.103.0
from fastapi.responses import JSONResponse  # version: ^0.103.0
from opentelemetry import trace  # version: ^1.20.0
from prometheus_client import Counter, Gauge, Histogram  # version: ^0.17.1
from typing import Dict, Optional
from uuid import UUID
import time

from .connection_manager import ConnectionManager
from ..services.chat_service import ChatService
from ..utils.metrics import MetricsCollector

# Initialize structured logger
logger = structlog.get_logger(__name__)

# Constants
MESSAGE_TIMEOUT = 30  # Seconds to wait for message
MAX_RETRIES = 3
RATE_LIMIT = "100/minute"
BATCH_SIZE = 10

# Prometheus metrics
ACTIVE_CONNECTIONS = Gauge("websocket_active_connections", "Number of active WebSocket connections")
MESSAGE_LATENCY = Histogram("websocket_message_latency_seconds", "Message processing latency")
ERROR_COUNTER = Counter("websocket_errors_total", "Total WebSocket errors", ["type"])

@trace.instrument_class()
class ChatHandler:
    """
    Handles WebSocket chat connections and message processing with enterprise-grade security,
    monitoring, and reliability features.
    """

    def __init__(self, connection_manager: ConnectionManager, chat_service: ChatService):
        """Initialize chat handler with required services and monitoring."""
        self._connection_manager = connection_manager
        self._chat_service = chat_service
        self._connection_states: Dict[str, Dict] = {}
        self._message_cache: Dict[str, Dict] = {}
        self._metrics = MetricsCollector()
        
        # Initialize circuit breaker
        self._circuit_breaker = {
            'failures': 0,
            'last_failure': 0,
            'is_open': False,
            'reset_timeout': 60  # 60 seconds timeout
        }

        logger.info("Chat handler initialized")

    @trace.instrument()
    async def handle_connection(self, websocket: WebSocket, client_id: str, 
                              session_id: UUID, tenant_id: str) -> None:
        """
        Handle new WebSocket connection with security and monitoring.

        Args:
            websocket: WebSocket connection instance
            client_id: Client identifier
            session_id: Chat session identifier
            tenant_id: Tenant identifier for isolation
        """
        connection_id = f"{client_id}:{session_id}"
        
        try:
            # Apply rate limiting
            if not self._check_rate_limit(client_id):
                await websocket.close(code=1008, reason="Rate limit exceeded")
                ERROR_COUNTER.labels(type="rate_limit").inc()
                return

            # Register new connection
            if not await self._connection_manager.connect(websocket, client_id):
                logger.error("Connection registration failed",
                           extra={'client_id': client_id, 'session_id': str(session_id)})
                return

            ACTIVE_CONNECTIONS.inc()
            
            # Initialize connection state
            self._connection_states[connection_id] = {
                'last_activity': time.time(),
                'message_count': 0,
                'tenant_id': tenant_id
            }

            # Verify chat session exists
            chat_session = await self._chat_service.get_session(session_id)
            if not chat_session:
                await websocket.close(code=1008, reason="Invalid session")
                return

            # Send connection confirmation
            await self._connection_manager.send_personal_message(
                json.dumps({
                    'type': 'connection_established',
                    'session_id': str(session_id)
                }),
                websocket
            )

            # Message handling loop
            while True:
                try:
                    # Wait for message with timeout
                    message = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=MESSAGE_TIMEOUT
                    )

                    # Process message
                    with MESSAGE_LATENCY.time():
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

                    # Update activity timestamp
                    self._connection_states[connection_id]['last_activity'] = time.time()
                    self._connection_states[connection_id]['message_count'] += 1

                except asyncio.TimeoutError:
                    # Check for connection timeout
                    if time.time() - self._connection_states[connection_id]['last_activity'] > MESSAGE_TIMEOUT:
                        logger.warning("Connection timeout",
                                    extra={'client_id': client_id, 'session_id': str(session_id)})
                        break
                    continue

                except WebSocketDisconnect:
                    logger.info("Client disconnected",
                              extra={'client_id': client_id, 'session_id': str(session_id)})
                    break

        except Exception as e:
            ERROR_COUNTER.labels(type="connection_error").inc()
            logger.error("Connection handler error",
                        extra={
                            'error': str(e),
                            'client_id': client_id,
                            'session_id': str(session_id)
                        })
            
        finally:
            # Cleanup connection
            await self._connection_manager.disconnect(websocket, client_id)
            ACTIVE_CONNECTIONS.dec()
            
            if connection_id in self._connection_states:
                del self._connection_states[connection_id]

    @trace.instrument()
    async def process_message(self, websocket: WebSocket, session_id: UUID,
                            message_content: str, tenant_id: str) -> Dict:
        """
        Process incoming chat message with reliability features.

        Args:
            websocket: WebSocket connection
            session_id: Chat session identifier
            message_content: Message content
            tenant_id: Tenant identifier

        Returns:
            Dict containing processed message response
        """
        try:
            # Check circuit breaker
            if self._circuit_breaker['is_open']:
                if time.time() - self._circuit_breaker['last_failure'] > self._circuit_breaker['reset_timeout']:
                    self._circuit_breaker['is_open'] = False
                    self._circuit_breaker['failures'] = 0
                else:
                    raise Exception("Circuit breaker is open")

            # Validate message format
            try:
                message_data = json.loads(message_content)
            except json.JSONDecodeError:
                return {'error': 'Invalid message format'}

            # Process message with retry mechanism
            for attempt in range(MAX_RETRIES):
                try:
                    # Send typing indicator
                    await self._connection_manager.send_personal_message(
                        json.dumps({'type': 'typing_indicator', 'status': 'active'}),
                        websocket
                    )

                    # Process message
                    response = await self._chat_service.process_message(
                        session_id,
                        message_data.get('content', ''),
                        {'tenant_id': tenant_id}
                    )

                    # Cache successful response
                    cache_key = f"{session_id}:{hash(message_content)}"
                    self._message_cache[cache_key] = response

                    # Reset circuit breaker on success
                    self._circuit_breaker['failures'] = 0
                    self._circuit_breaker['is_open'] = False

                    return response

                except Exception as e:
                    if attempt == MAX_RETRIES - 1:
                        raise e
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff

            return {'error': 'Message processing failed'}

        except Exception as e:
            # Update circuit breaker
            self._circuit_breaker['failures'] += 1
            self._circuit_breaker['last_failure'] = time.time()
            if self._circuit_breaker['failures'] >= 5:
                self._circuit_breaker['is_open'] = True

            ERROR_COUNTER.labels(type="processing_error").inc()
            logger.error("Message processing error",
                        extra={
                            'error': str(e),
                            'session_id': str(session_id),
                            'tenant_id': tenant_id
                        })
            return {'error': 'Internal processing error'}

    def _check_rate_limit(self, client_id: str) -> bool:
        """
        Check rate limiting for client connections.

        Args:
            client_id: Client identifier

        Returns:
            bool: True if within rate limit, False otherwise
        """
        current_time = time.time()
        rate_key = f"rate:{client_id}"
        
        if rate_key not in self._connection_states:
            self._connection_states[rate_key] = {
                'count': 1,
                'window_start': current_time
            }
            return True

        rate_data = self._connection_states[rate_key]
        
        # Reset window if needed
        if current_time - rate_data['window_start'] >= 60:
            rate_data['count'] = 1
            rate_data['window_start'] = current_time
            return True

        # Check rate limit
        if rate_data['count'] >= 100:  # 100 requests per minute
            return False

        rate_data['count'] += 1
        return True

    @trace.instrument()
    async def health_check(self) -> Dict:
        """
        Perform health check on chat handler.

        Returns:
            Dict containing health status information
        """
        try:
            health_status = {
                'status': 'healthy',
                'active_connections': ACTIVE_CONNECTIONS._value.get(),
                'circuit_breaker': {
                    'status': 'open' if self._circuit_breaker['is_open'] else 'closed',
                    'failures': self._circuit_breaker['failures']
                },
                'cache_size': len(self._message_cache),
                'timestamp': time.time()
            }

            # Check connection manager health
            connection_status = await self._connection_manager.health_check()
            health_status['connection_manager'] = connection_status

            return health_status

        except Exception as e:
            logger.error("Health check failed", extra={'error': str(e)})
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': time.time()
            }