"""
WebSocket initialization module for the AI-powered Product Catalog Search System.
Provides centralized access to WebSocket handlers with enhanced security, monitoring,
and real-time communication features.

Version: 1.0.0
"""

from .connection_manager import ConnectionManager
from .chat_handler import ChatHandler
from .notification_handler import NotificationHandler

# Version tracking for WebSocket components
VERSION = "1.0.0"

# WebSocket configuration constants
WEBSOCKET_PING_INTERVAL = 30  # Seconds between ping messages

# Export core WebSocket functionality
__all__ = [
    'ConnectionManager',
    'ChatHandler',
    'NotificationHandler',
    'VERSION',
    'WEBSOCKET_PING_INTERVAL'
]

# Initialize connection manager with enhanced security
connection_manager = ConnectionManager()

# Initialize handlers with connection manager
chat_handler = ChatHandler(connection_manager)
notification_handler = NotificationHandler(connection_manager)

# Export handler instances for direct access
__all__.extend([
    'connection_manager',
    'chat_handler',
    'notification_handler'
])

# Export connection management methods
connect = connection_manager.connect
disconnect = connection_manager.disconnect
send_personal_message = connection_manager.send_personal_message
broadcast_to_client = connection_manager.broadcast_to_client

# Export chat functionality
handle_chat_connection = chat_handler.handle_connection
process_chat_message = chat_handler.process_message

# Export notification functionality
send_system_notification = notification_handler.send_system_notification
send_document_notification = notification_handler.send_document_notification
start_status_monitor = notification_handler.start_status_monitor
stop_status_monitor = notification_handler.stop_status_monitor

# Export additional connection management methods
__all__.extend([
    'connect',
    'disconnect',
    'send_personal_message',
    'broadcast_to_client',
    'handle_chat_connection',
    'process_chat_message',
    'send_system_notification',
    'send_document_notification',
    'start_status_monitor',
    'stop_status_monitor'
])