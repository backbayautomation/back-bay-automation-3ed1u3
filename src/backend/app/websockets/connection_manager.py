"""
WebSocket connection manager for real-time chat functionality with multi-tenant isolation.
Handles connection lifecycle, message distribution, and connection state management.

Version: 1.0.0
"""

from fastapi.websockets import WebSocket, WebSocketDisconnect, WebSocketState  # version: 0.103.0
import asyncio  # Python 3.11+
import weakref  # Python 3.11+
from typing import Dict, Optional

from ..utils.logging import StructuredLogger
from ..utils.metrics import MetricsCollector

# Initialize structured logger
logger = StructuredLogger(__name__)

# Constants for connection management
PING_INTERVAL = 30  # Seconds between ping messages
MAX_CONNECTIONS_PER_CLIENT = 100  # Maximum concurrent connections per client
CONNECTION_TIMEOUT = 60  # Seconds to wait for pong response
BROADCAST_CHUNK_SIZE = 50  # Number of connections to process in parallel during broadcast

class ConnectionManager:
    """
    Manages WebSocket connections with multi-tenant isolation and performance monitoring.
    Implements connection lifecycle, heartbeat mechanism, and efficient message distribution.
    """

    def __init__(self, metrics_collector: MetricsCollector):
        """
        Initialize connection manager with connection tracking and metrics collection.
        
        Args:
            metrics_collector: MetricsCollector instance for performance monitoring
        """
        # Multi-tenant connection storage using weak references for automatic cleanup
        self._active_connections: Dict[str, Dict[str, weakref.WeakSet[WebSocket]]] = {}
        
        # Thread-safe locks for client operations
        self._client_locks: Dict[str, asyncio.Lock] = {}
        
        # Connection count tracking
        self._connection_counts: Dict[str, int] = {}
        
        # Metrics collector for monitoring
        self._metrics = metrics_collector

    async def connect(self, websocket: WebSocket, client_id: str) -> bool:
        """
        Connect a new WebSocket client with tenant isolation and connection limit enforcement.
        
        Args:
            websocket: WebSocket connection instance
            client_id: Client identifier for tenant isolation
            
        Returns:
            bool: Connection success status
        """
        try:
            # Get or create client lock
            if client_id not in self._client_locks:
                self._client_locks[client_id] = asyncio.Lock()
            
            async with self._client_locks[client_id]:
                # Check connection limit
                current_count = self._connection_counts.get(client_id, 0)
                if current_count >= MAX_CONNECTIONS_PER_CLIENT:
                    logger.warning(f"Connection limit reached for client {client_id}")
                    return False
                
                # Accept WebSocket connection
                await websocket.accept()
                
                # Initialize client connection set if needed
                if client_id not in self._active_connections:
                    self._active_connections[client_id] = {"connections": weakref.WeakSet()}
                
                # Add connection to set
                self._active_connections[client_id]["connections"].add(websocket)
                
                # Update connection count
                self._connection_counts[client_id] = current_count + 1
                
                # Start heartbeat task
                asyncio.create_task(self._heartbeat(websocket))
                
                # Record metrics
                self._metrics.increment_counter("websocket_connections_total", 
                                             labels={"client_id": client_id})
                self._metrics.set_gauge("websocket_connections_active",
                                      self._connection_counts[client_id],
                                      labels={"client_id": client_id})
                
                logger.info(f"New WebSocket connection established for client {client_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error establishing WebSocket connection: {str(e)}")
            return False

    async def disconnect(self, websocket: WebSocket, client_id: str) -> None:
        """
        Disconnect a WebSocket client and cleanup resources with proper error handling.
        
        Args:
            websocket: WebSocket connection to disconnect
            client_id: Client identifier for tenant isolation
        """
        try:
            async with self._client_locks[client_id]:
                # Remove connection from set
                if client_id in self._active_connections:
                    self._active_connections[client_id]["connections"].discard(websocket)
                    
                    # Update connection count
                    self._connection_counts[client_id] = max(0, self._connection_counts[client_id] - 1)
                    
                    # Cleanup empty client entry
                    if not self._active_connections[client_id]["connections"]:
                        del self._active_connections[client_id]
                        del self._connection_counts[client_id]
                
                # Close WebSocket connection
                if websocket.client_state != WebSocketState.DISCONNECTED:
                    await websocket.close()
                
                # Record metrics
                self._metrics.increment_counter("websocket_disconnections_total",
                                             labels={"client_id": client_id})
                self._metrics.set_gauge("websocket_connections_active",
                                      self._connection_counts.get(client_id, 0),
                                      labels={"client_id": client_id})
                
                logger.info(f"WebSocket connection closed for client {client_id}")
                
        except Exception as e:
            logger.error(f"Error during WebSocket disconnection: {str(e)}")

    async def send_personal_message(self, message: str, websocket: WebSocket) -> bool:
        """
        Send a message to a specific client's WebSocket connection with error handling.
        
        Args:
            message: Message content to send
            websocket: Target WebSocket connection
            
        Returns:
            bool: Message sending success status
        """
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                async with asyncio.timeout(5.0):  # 5 second timeout for sending
                    await websocket.send_text(message)
                    self._metrics.increment_counter("websocket_messages_sent")
                    return True
            return False
            
        except Exception as e:
            logger.error(f"Error sending personal message: {str(e)}")
            return False

    async def broadcast_to_client(self, message: str, client_id: str) -> None:
        """
        Broadcast a message to all connections of a specific client with chunking.
        
        Args:
            message: Message content to broadcast
            client_id: Target client identifier
        """
        try:
            if client_id not in self._active_connections:
                return
            
            connections = list(self._active_connections[client_id]["connections"])
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
                self._metrics.increment_counter("websocket_broadcast_messages_sent",
                                             value=successful_sends,
                                             labels={"client_id": client_id})
            
            logger.info(f"Broadcast completed for client {client_id}")
            
        except Exception as e:
            logger.error(f"Error during broadcast: {str(e)}")

    def get_client_connection_count(self, client_id: str) -> int:
        """
        Get the number of active connections for a client.
        
        Args:
            client_id: Client identifier
            
        Returns:
            int: Number of active connections
        """
        return self._connection_counts.get(client_id, 0)

    async def _heartbeat(self, websocket: WebSocket) -> None:
        """
        Maintain connection health with ping/pong mechanism.
        
        Args:
            websocket: WebSocket connection to monitor
        """
        try:
            while websocket.client_state == WebSocketState.CONNECTED:
                try:
                    # Send ping and wait for pong with timeout
                    async with asyncio.timeout(CONNECTION_TIMEOUT):
                        await websocket.send_text("ping")
                        await websocket.receive_text()  # Wait for pong
                    
                    await asyncio.sleep(PING_INTERVAL)
                    
                except asyncio.TimeoutError:
                    logger.warning("WebSocket heartbeat timeout")
                    break
                    
        except WebSocketDisconnect:
            pass  # Normal disconnection
        except Exception as e:
            logger.error(f"Error in heartbeat maintenance: {str(e)}")
        finally:
            # Ensure connection is closed
            if websocket.client_state != WebSocketState.DISCONNECTED:
                await websocket.close()