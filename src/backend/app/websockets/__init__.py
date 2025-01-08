"""
WebSocket initialization module for the AI-powered Product Catalog Search System.
Provides centralized access to WebSocket handlers for chat, notifications, and connection management.

Version: 1.0.0
"""

from typing import Dict, Optional
from fastapi import WebSocket
from uuid import UUID

from .connection_manager import ConnectionManager
from .chat_handler import ChatHandler
from .notification_handler import NotificationHandler

# Initialize version
VERSION = "1.0.0"

# WebSocket ping interval in seconds
WEBSOCKET_PING_INTERVAL = 30

class WebSocketManager:
    """
    Centralized WebSocket management class providing access to all WebSocket functionality
    with enhanced security, monitoring, and multi-tenant isolation.
    """

    def __init__(self):
        """Initialize WebSocket manager with required handlers."""
        self._connection_manager = ConnectionManager()
        self._chat_handlers: Dict[str, ChatHandler] = {}
        self._notification_handlers: Dict[str, NotificationHandler] = {}

    async def handle_chat_connection(
        self,
        websocket: WebSocket,
        client_id: str,
        session_id: UUID,
        tenant_id: str
    ) -> None:
        """
        Handle new chat WebSocket connection with security and monitoring.

        Args:
            websocket: WebSocket connection instance
            client_id: Client identifier
            session_id: Chat session UUID
            tenant_id: Tenant identifier for isolation
        """
        # Get or create chat handler for tenant
        if tenant_id not in self._chat_handlers:
            self._chat_handlers[tenant_id] = ChatHandler(
                self._connection_manager,
                chat_service=None  # Injected by service layer
            )

        # Handle connection with tenant isolation
        await self._chat_handlers[tenant_id].handle_connection(
            websocket,
            client_id,
            session_id,
            tenant_id
        )

    async def handle_notification_connection(
        self,
        websocket: WebSocket,
        client_id: str,
        tenant_id: str
    ) -> None:
        """
        Handle new notification WebSocket connection with security and monitoring.

        Args:
            websocket: WebSocket connection instance
            client_id: Client identifier
            tenant_id: Tenant identifier for isolation
        """
        # Get or create notification handler for tenant
        if tenant_id not in self._notification_handlers:
            self._notification_handlers[tenant_id] = NotificationHandler(
                self._connection_manager,
                analytics_service=None  # Injected by service layer
            )

        # Start status monitoring for client
        await self._notification_handlers[tenant_id].start_status_monitor(client_id)

        # Accept connection
        await self._connection_manager.connect(websocket, client_id)

    async def send_system_notification(
        self,
        client_id: str,
        message: str,
        tenant_id: str,
        level: str = 'info',
        metadata: Optional[Dict] = None
    ) -> bool:
        """
        Send system notification to client with tenant isolation.

        Args:
            client_id: Client identifier
            message: Notification message
            tenant_id: Tenant identifier
            level: Notification level
            metadata: Optional notification metadata

        Returns:
            bool: Success status of notification delivery
        """
        if tenant_id not in self._notification_handlers:
            return False

        return await self._notification_handlers[tenant_id].send_system_notification(
            client_id,
            message,
            level,
            metadata
        )

    async def send_document_notification(
        self,
        client_id: str,
        document_id: str,
        status: str,
        tenant_id: str,
        metadata: Optional[Dict] = None
    ) -> bool:
        """
        Send document processing notification with tenant isolation.

        Args:
            client_id: Client identifier
            document_id: Document identifier
            status: Processing status
            tenant_id: Tenant identifier
            metadata: Optional notification metadata

        Returns:
            bool: Success status of notification delivery
        """
        if tenant_id not in self._notification_handlers:
            return False

        message = f"Document {document_id} status: {status}"
        metadata = metadata or {}
        metadata.update({
            'document_id': document_id,
            'status': status
        })

        return await self._notification_handlers[tenant_id].send_system_notification(
            client_id,
            message,
            'info',
            metadata
        )

    async def cleanup_tenant(self, tenant_id: str) -> None:
        """
        Clean up tenant-specific WebSocket handlers and connections.

        Args:
            tenant_id: Tenant identifier to cleanup
        """
        if tenant_id in self._chat_handlers:
            del self._chat_handlers[tenant_id]

        if tenant_id in self._notification_handlers:
            del self._notification_handlers[tenant_id]

# Export singleton instance
websocket_manager = WebSocketManager()

# Export required classes and constants
__all__ = [
    'websocket_manager',
    'ConnectionManager',
    'ChatHandler',
    'NotificationHandler',
    'VERSION',
    'WEBSOCKET_PING_INTERVAL'
]