"""
WebSocket initialization module for real-time communication in the AI-powered Product Catalog Search System.
Provides centralized access to WebSocket handlers with multi-tenant isolation and monitoring.

Version: 1.0.0
"""

from .connection_manager import ConnectionManager
from .chat_handler import ChatHandler
from .notification_handler import NotificationHandler

# Export WebSocket functionality
__all__ = [
    'ConnectionManager',
    'ChatHandler',
    'NotificationHandler'
]

# Global WebSocket configuration
VERSION = "1.0.0"
WEBSOCKET_PING_INTERVAL = 30  # Seconds between ping messages

# Initialize connection manager with monitoring
connection_manager = ConnectionManager()

# Initialize handlers with connection manager
chat_handler = ChatHandler(connection_manager)
notification_handler = NotificationHandler(connection_manager)

async def initialize_websocket_handlers():
    """
    Initialize WebSocket handlers with required dependencies and monitoring.
    Must be called during application startup.
    """
    try:
        # Start notification monitoring
        await notification_handler.start_status_monitor()
        
        # Initialize connection manager monitoring
        await connection_manager.initialize_monitoring()
        
        return True
    except Exception as e:
        logger.error(f"Failed to initialize WebSocket handlers: {str(e)}")
        return False

async def cleanup_websocket_handlers():
    """
    Cleanup WebSocket handlers and connections.
    Must be called during application shutdown.
    """
    try:
        # Stop notification monitoring
        await notification_handler.stop_status_monitor()
        
        # Close all active connections
        await connection_manager.close_all_connections()
        
        return True
    except Exception as e:
        logger.error(f"Failed to cleanup WebSocket handlers: {str(e)}")
        return False

# Export initialization functions
__all__.extend([
    'initialize_websocket_handlers',
    'cleanup_websocket_handlers'
])