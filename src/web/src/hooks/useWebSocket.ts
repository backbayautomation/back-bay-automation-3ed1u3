/**
 * @fileoverview Enterprise-grade custom React hook for WebSocket connection management
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // v18.2.0
import { WebSocketClient, WS_EVENTS } from '../api/websocket';

/**
 * Connection state enumeration
 */
export enum ConnectionState {
    DISCONNECTED = 'DISCONNECTED',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    RECONNECTING = 'RECONNECTING'
}

/**
 * Interface for queued messages during disconnection
 */
interface QueuedMessage {
    event: string;
    data: any;
    timestamp: string;
}

/**
 * Interface for connection metrics
 */
interface ConnectionMetrics {
    latency: number;
    messagesSent: number;
    messagesReceived: number;
    reconnectAttempts: number;
    lastHeartbeat: string;
    uptime: number;
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
 * Enterprise-grade WebSocket hook return type
 */
interface UseWebSocketReturn {
    isConnected: boolean;
    connectionState: ConnectionState;
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
 * Enterprise-grade custom hook for WebSocket connection management
 */
export const useWebSocket = ({
    baseUrl,
    token,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
    messageQueueSize = 100,
    compressionEnabled = false,
    monitoringEnabled = true
}: UseWebSocketOptions): UseWebSocketReturn => {
    // WebSocket client reference
    const wsClient = useRef<WebSocketClient | null>(null);
    
    // Connection state management
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
    const [isConnected, setIsConnected] = useState(false);
    
    // Metrics tracking
    const metricsRef = useRef<ConnectionMetrics>({
        latency: 0,
        messagesSent: 0,
        messagesReceived: 0,
        reconnectAttempts: 0,
        lastHeartbeat: new Date().toISOString(),
        uptime: 0
    });

    // Message queue for handling disconnections
    const messageQueueRef = useRef<QueuedMessage[]>([]);
    const uptimeInterval = useRef<NodeJS.Timeout>();

    /**
     * Initialize WebSocket client
     */
    const initializeClient = useCallback(() => {
        if (!wsClient.current) {
            wsClient.current = new WebSocketClient(baseUrl, token, {
                reconnectMaxAttempts: reconnectAttempts,
                reconnectBaseDelay: reconnectInterval,
                messageBufferSize: messageQueueSize
            });
        }
    }, [baseUrl, token, reconnectAttempts, reconnectInterval, messageQueueSize]);

    /**
     * Connect to WebSocket server
     */
    const connect = useCallback(async () => {
        if (connectionState === ConnectionState.CONNECTING || 
            connectionState === ConnectionState.CONNECTED) {
            return;
        }

        setConnectionState(ConnectionState.CONNECTING);
        
        try {
            initializeClient();
            await wsClient.current?.connect();
            setIsConnected(true);
            setConnectionState(ConnectionState.CONNECTED);
        } catch (error) {
            setConnectionState(ConnectionState.DISCONNECTED);
            throw error;
        }
    }, [connectionState, initializeClient]);

    /**
     * Disconnect from WebSocket server
     */
    const disconnect = useCallback(() => {
        wsClient.current?.disconnect();
        setIsConnected(false);
        setConnectionState(ConnectionState.DISCONNECTED);
    }, []);

    /**
     * Send message through WebSocket
     */
    const sendMessage = useCallback(async (event: string, data: any) => {
        if (!wsClient.current || !isConnected) {
            const queuedMessage: QueuedMessage = {
                event,
                data,
                timestamp: new Date().toISOString()
            };
            
            if (messageQueueRef.current.length < messageQueueSize) {
                messageQueueRef.current.push(queuedMessage);
            }
            throw new Error('WebSocket not connected');
        }

        try {
            await wsClient.current.send(event, data, {
                retry: true,
                compress: compressionEnabled
            });
            metricsRef.current.messagesSent++;
        } catch (error) {
            throw error;
        }
    }, [isConnected, messageQueueSize, compressionEnabled]);

    /**
     * Add event listener
     */
    const addListener = useCallback((event: string, callback: Function) => {
        wsClient.current?.on(event, callback);
    }, []);

    /**
     * Remove event listener
     */
    const removeListener = useCallback((event: string, callback: Function) => {
        wsClient.current?.off(event, callback);
    }, []);

    /**
     * Get connection metrics
     */
    const getMetrics = useCallback((): ConnectionMetrics => {
        return { ...metricsRef.current };
    }, []);

    /**
     * Clear message queue
     */
    const clearMessageQueue = useCallback(() => {
        messageQueueRef.current = [];
    }, []);

    /**
     * Get pending messages
     */
    const getPendingMessages = useCallback((): QueuedMessage[] => {
        return [...messageQueueRef.current];
    }, []);

    /**
     * Set up WebSocket event listeners
     */
    useEffect(() => {
        if (!wsClient.current) return;

        const handleConnectionHealth = (data: any) => {
            if (data.status === 'connected') {
                setIsConnected(true);
                setConnectionState(ConnectionState.CONNECTED);
            } else {
                setIsConnected(false);
                setConnectionState(ConnectionState.DISCONNECTED);
            }
            metricsRef.current.lastHeartbeat = new Date().toISOString();
        };

        const handleMessage = () => {
            metricsRef.current.messagesReceived++;
        };

        wsClient.current.on(WS_EVENTS.CONNECTION_HEALTH, handleConnectionHealth);
        wsClient.current.on(WS_EVENTS.CHAT_MESSAGE, handleMessage);

        return () => {
            if (wsClient.current) {
                wsClient.current.off(WS_EVENTS.CONNECTION_HEALTH, handleConnectionHealth);
                wsClient.current.off(WS_EVENTS.CHAT_MESSAGE, handleMessage);
            }
        };
    }, []);

    /**
     * Handle automatic connection
     */
    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    /**
     * Monitor connection uptime
     */
    useEffect(() => {
        if (monitoringEnabled && isConnected) {
            uptimeInterval.current = setInterval(() => {
                metricsRef.current.uptime += 1;
            }, 1000);
        }

        return () => {
            if (uptimeInterval.current) {
                clearInterval(uptimeInterval.current);
            }
        };
    }, [monitoringEnabled, isConnected]);

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