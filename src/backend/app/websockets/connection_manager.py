"""
WebSocket connection manager for real-time chat functionality in the AI-powered catalog search system.
Handles connection lifecycle, message distribution, and connection state management with multi-tenant isolation.

Version: 1.0.0
"""

from fastapi.websockets import WebSocket, WebSocketDisconnect, WebSocketState  # version: ^0.103.0
import asyncio  # Python 3.11+
import weakref  # Python 3.11+
from typing import Dict, Optional

from ..utils.logging import StructuredLogger  # Internal import
from ..utils.metrics import MetricsCollector  # Internal import

# Initialize structured logger
logger = StructuredLogger(__name__)

# Constants for connection management
PING_INTERVAL = 30  # Seconds between ping messages
MAX_CONNECTIONS_PER_CLIENT = 100  # Maximum concurrent connections per client
CONNECTION_TIMEOUT = 60  # Seconds to wait before considering connection dead
BROADCAST_CHUNK_SIZE = 50  # Number of connections to process in parallel during broadcast

class ConnectionManager:
    """Manages WebSocket connections with multi-tenant isolation and performance monitoring."""

    def __init__(self, metrics_collector: MetricsCollector):
        """Initialize connection manager with connection tracking structures and metrics collection."""
        # Multi-tenant connection storage using weak references for automatic cleanup
        self._active_connections: Dict[str, Dict[str, weakref.WeakSet[WebSocket]]] = {}
        
        # Thread-safe locks for client operations
        self._client_locks: Dict[str, asyncio.Lock] = {}
        
        # Connection count tracking
        self._connection_counts: Dict[str, int] = {}
        
        # Metrics collector for monitoring
        self._metrics = metrics_collector

    async def connect(self, websocket: WebSocket, client_id: str) -> bool:
        """Connect a new WebSocket client with tenant isolation and connection limit enforcement."""
        try:
            # Ensure client lock exists
            if client_id not in self._client_locks:
                self._client_locks[client_id] = asyncio.Lock()
            
            async with self._client_locks[client_id]:
                # Check connection limit
                current_count = self._connection_counts.get(client_id, 0)
                if current_count >= MAX_CONNECTIONS_PER_CLIENT:
                    logger.warning(f"Connection limit reached for client {client_id}")
                    return False
                
                # Initialize client connection set if needed
                if client_id not in self._active_connections:
                    self._active_connections[client_id] = weakref.WeakSet()
                
                # Accept connection
                await websocket.accept()
                
                # Add to active connections
                self._active_connections[client_id].add(websocket)
                self._connection_counts[client_id] = current_count + 1
                
                # Start heartbeat task
                asyncio.create_task(self.heartbeat(websocket))
                
                # Record metrics
                self._metrics.increment_counter("websocket_connections", 1, {"client_id": client_id})
                
                logger.info(f"New WebSocket connection established for client {client_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error connecting WebSocket for client {client_id}: {str(e)}")
            return False

    async def disconnect(self, websocket: WebSocket, client_id: str) -> None:
        """Disconnect a WebSocket client and cleanup resources with proper error handling."""
        try:
            async with self._client_locks[client_id]:
                # Remove from active connections
                if client_id in self._active_connections:
                    self._active_connections[client_id].discard(websocket)
                    self._connection_counts[client_id] = max(0, self._connection_counts[client_id] - 1)
                    
                    # Cleanup empty connection sets
                    if not self._active_connections[client_id]:
                        del self._active_connections[client_id]
                        del self._connection_counts[client_id]
                
                # Close connection if still open
                if websocket.client_state != WebSocketState.DISCONNECTED:
                    await websocket.close()
                
                # Record metrics
                self._metrics.increment_counter("websocket_disconnections", 1, {"client_id": client_id})
                
                logger.info(f"WebSocket connection closed for client {client_id}")
                
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket for client {client_id}: {str(e)}")

    async def send_personal_message(self, message: str, websocket: WebSocket) -> bool:
        """Send a message to a specific client's WebSocket connection with error handling."""
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await asyncio.wait_for(
                    websocket.send_text(message),
                    timeout=CONNECTION_TIMEOUT
                )
                self._metrics.increment_counter("websocket_messages_sent", 1)
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error sending personal message: {str(e)}")
            return False

    async def broadcast_to_client(self, message: str, client_id: str) -> None:
        """Broadcast a message to all connections of a specific client with chunking and error handling."""
        try:
            if client_id not in self._active_connections:
                return
            
            connections = list(self._active_connections[client_id])
            total_connections = len(connections)
            
            # Process connections in chunks for efficiency
            for i in range(0, total_connections, BROADCAST_CHUNK_SIZE):
                chunk = connections[i:i + BROADCAST_CHUNK_SIZE]
                tasks = [
                    self.send_personal_message(message, conn)
                    for conn in chunk
                    if conn.client_state == WebSocketState.CONNECTED
                ]
                
                # Wait for all sends in chunk to complete
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Record metrics
                successful_sends = sum(1 for r in results if r is True)
                self._metrics.increment_counter(
                    "websocket_broadcast_messages",
                    successful_sends,
                    {"client_id": client_id}
                )
            
            logger.info(f"Broadcast completed for client {client_id}")
            
        except Exception as e:
            logger.error(f"Error broadcasting message to client {client_id}: {str(e)}")

    def get_client_connection_count(self, client_id: str) -> int:
        """Get the number of active connections for a client with cache optimization."""
        return self._connection_counts.get(client_id, 0)

    async def heartbeat(self, websocket: WebSocket) -> None:
        """Maintain connection health with ping/pong mechanism."""
        try:
            while websocket.client_state == WebSocketState.CONNECTED:
                await asyncio.sleep(PING_INTERVAL)
                try:
                    await asyncio.wait_for(
                        websocket.send_text("ping"),
                        timeout=CONNECTION_TIMEOUT
                    )
                    await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=CONNECTION_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    logger.warning("WebSocket heartbeat timeout")
                    break
                    
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error(f"Error in WebSocket heartbeat: {str(e)}")
        finally:
            # Connection is dead, ensure cleanup
            if websocket.client_state != WebSocketState.DISCONNECTED:
                await websocket.close()