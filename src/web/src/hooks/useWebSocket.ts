/**
 * @fileoverview Enterprise-grade custom React hook for WebSocket connection management
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // v18.2.0
import { WebSocketClient, WS_EVENTS } from '../api/websocket';
import { WebSocketStatus } from '../types/chat';

/**
 * Connection metrics interface for monitoring
 */
interface ConnectionMetrics {
    latency: number;
    messagesSent: number;
    messagesReceived: number;
    reconnectAttempts: number;
    lastHeartbeat: number;
}

/**
 * Queued message structure for handling disconnections
 */
interface QueuedMessage {
    event: string;
    data: any;
    timestamp: number;
}

/**
 * Configuration options for WebSocket hook
 */
interface UseWebSocketOptions {
    baseUrl: string;
    token: string;
    autoConnect?: boolean;
    reconnectAttempts?: number;
    reconnectInterval?: number;
    messageQueueSize?: number;
    compressionEnabled?: boolean;
    monitoringEnabled?: boolean;
}

/**
 * Enhanced return value with connection state and monitoring
 */
interface UseWebSocketReturn {
    isConnected: boolean;
    connectionState: WebSocketStatus;
    connect: () => Promise<void>;
    disconnect: () => void;
    sendMessage: (event: string, data: any) => Promise<void>;
    addListener: (event: string, callback: Function) => void;
    removeListener: (event: string, callback: Function) => void;
    getMetrics: () => ConnectionMetrics;
    clearMessageQueue: () => void;
    getPendingMessages: () => QueuedMessage[];
}

/**
 * Enterprise-grade hook for WebSocket connection management
 */
export const useWebSocket = ({
    baseUrl,
    token,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
    messageQueueSize = 100,
    compressionEnabled = true,
    monitoringEnabled = true
}: UseWebSocketOptions): UseWebSocketReturn => {
    // Client reference to maintain instance across renders
    const clientRef = useRef<WebSocketClient | null>(null);
    
    // Connection state management
    const [isConnected, setIsConnected] = useState(false);
    const [connectionState, setConnectionState] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED);
    
    // Metrics state for monitoring
    const [metrics, setMetrics] = useState<ConnectionMetrics>({
        latency: 0,
        messagesSent: 0,
        messagesReceived: 0,
        reconnectAttempts: 0,
        lastHeartbeat: 0
    });

    /**
     * Initialize WebSocket client with configuration
     */
    const initializeClient = useCallback(() => {
        if (!clientRef.current) {
            clientRef.current = new WebSocketClient(baseUrl, token, {
                reconnectMaxAttempts: reconnectAttempts,
                reconnectBaseDelay: reconnectInterval,
                messageBufferSize: messageQueueSize
            });
        }
    }, [baseUrl, token, reconnectAttempts, reconnectInterval, messageQueueSize]);

    /**
     * Connect to WebSocket server with monitoring
     */
    const connect = useCallback(async () => {
        try {
            setConnectionState(WebSocketStatus.CONNECTING);
            await clientRef.current?.connect();
            setIsConnected(true);
            setConnectionState(WebSocketStatus.CONNECTED);
        } catch (error) {
            setConnectionState(WebSocketStatus.DISCONNECTED);
            throw error;
        }
    }, []);

    /**
     * Disconnect from WebSocket server
     */
    const disconnect = useCallback(() => {
        clientRef.current?.disconnect();
        setIsConnected(false);
        setConnectionState(WebSocketStatus.DISCONNECTED);
    }, []);

    /**
     * Send message with reliability options
     */
    const sendMessage = useCallback(async (event: string, data: any) => {
        if (!clientRef.current) throw new Error('WebSocket client not initialized');
        
        await clientRef.current.send(event, data, {
            retry: true,
            compress: compressionEnabled,
            timeout: 5000
        });

        if (monitoringEnabled) {
            setMetrics(prev => ({
                ...prev,
                messagesSent: prev.messagesSent + 1
            }));
        }
    }, [compressionEnabled, monitoringEnabled]);

    /**
     * Add event listener with type safety
     */
    const addListener = useCallback((event: string, callback: Function) => {
        clientRef.current?.on(event, callback as any);
    }, []);

    /**
     * Remove event listener
     */
    const removeListener = useCallback((event: string, callback: Function) => {
        clientRef.current?.off(event, callback as any);
    }, []);

    /**
     * Get current connection metrics
     */
    const getMetrics = useCallback((): ConnectionMetrics => {
        return metrics;
    }, [metrics]);

    /**
     * Clear pending message queue
     */
    const clearMessageQueue = useCallback(() => {
        if (clientRef.current) {
            // Access internal queue through WebSocketClient method
            clientRef.current.messageQueue = [];
        }
    }, []);

    /**
     * Get pending messages in queue
     */
    const getPendingMessages = useCallback((): QueuedMessage[] => {
        if (!clientRef.current) return [];
        return clientRef.current.messageQueue.map(msg => ({
            event: msg.event,
            data: msg.data,
            timestamp: Date.now()
        }));
    }, []);

    /**
     * Set up connection monitoring
     */
    useEffect(() => {
        if (!monitoringEnabled) return;

        const handleHeartbeat = () => {
            setMetrics(prev => ({
                ...prev,
                lastHeartbeat: Date.now()
            }));
        };

        const handleMessage = () => {
            setMetrics(prev => ({
                ...prev,
                messagesReceived: prev.messagesReceived + 1
            }));
        };

        addListener(WS_EVENTS.CONNECTION_HEALTH, handleHeartbeat);
        addListener(WS_EVENTS.CHAT_MESSAGE, handleMessage);

        return () => {
            removeListener(WS_EVENTS.CONNECTION_HEALTH, handleHeartbeat);
            removeListener(WS_EVENTS.CHAT_MESSAGE, handleMessage);
        };
    }, [monitoringEnabled, addListener, removeListener]);

    /**
     * Initialize client and handle auto-connect
     */
    useEffect(() => {
        initializeClient();

        if (autoConnect) {
            connect().catch(console.error);
        }

        return () => {
            disconnect();
        };
    }, [initializeClient, autoConnect, connect, disconnect]);

    return {
        isConnected,
        connectionState,
        connect,
        disconnect,
        sendMessage,
        addListener,
        removeListener,
        getMetrics,
        clearMessageQueue,
        getPendingMessages
    };
};