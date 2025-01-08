/**
 * Enterprise-grade custom React hook for WebSocket connection management
 * Version: 1.0.0
 * Dependencies:
 * - react: 18.2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // v18.2.0
import { WebSocketClient, WS_EVENTS } from '../api/websocket';
import { WebSocketStatus } from '../types/chat';

// Connection state management types
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// Interface for queued messages during disconnection
interface QueuedMessage {
  event: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

// Interface for connection metrics
interface ConnectionMetrics {
  latency: number;
  messagesSent: number;
  messagesReceived: number;
  reconnectAttempts: number;
  lastHeartbeat: number;
  uptime: number;
}

// Configuration options for the WebSocket hook
export interface UseWebSocketOptions {
  baseUrl: string;
  token: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  messageQueueSize?: number;
  compressionEnabled?: boolean;
  monitoringEnabled?: boolean;
}

// Return type for the WebSocket hook
export interface UseWebSocketReturn {
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
 * Provides robust connection handling, automatic reconnection, and monitoring
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
  // Client reference to maintain connection across renders
  const wsClientRef = useRef<WebSocketClient | null>(null);
  
  // State management
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([]);
  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    latency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    reconnectAttempts: 0,
    lastHeartbeat: 0,
    uptime: 0
  });

  // Performance monitoring
  const startTimeRef = useRef<number>(Date.now());
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized connection handler
  const connect = useCallback(async () => {
    if (wsClientRef.current) {
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      
      wsClientRef.current = new WebSocketClient(baseUrl, token, {
        reconnectMaxAttempts: reconnectAttempts,
        messageBufferSize: messageQueueSize
      });

      await wsClientRef.current.connect();
      setConnectionState(ConnectionState.CONNECTED);
      
      // Process queued messages after connection
      if (messageQueue.length > 0) {
        for (const msg of messageQueue) {
          await wsClientRef.current.send(msg.event, msg.data, {
            retry: true,
            compress: compressionEnabled
          });
        }
        setMessageQueue([]);
      }
    } catch (error) {
      setConnectionState(ConnectionState.ERROR);
      throw error;
    }
  }, [baseUrl, token, reconnectAttempts, messageQueueSize, messageQueue, compressionEnabled]);

  // Memoized disconnect handler
  const disconnect = useCallback(async () => {
    if (!wsClientRef.current) {
      return;
    }

    try {
      await wsClientRef.current.disconnect();
      wsClientRef.current = null;
      setConnectionState(ConnectionState.DISCONNECTED);
    } catch (error) {
      setConnectionState(ConnectionState.ERROR);
      throw error;
    }
  }, []);

  // Memoized message sender with queue support
  const sendMessage = useCallback(async (event: string, data: any) => {
    if (!wsClientRef.current || connectionState !== ConnectionState.CONNECTED) {
      if (messageQueue.length < messageQueueSize) {
        setMessageQueue(prev => [...prev, {
          event,
          data,
          timestamp: Date.now(),
          retryCount: 0
        }]);
        return;
      }
      throw new Error('Message queue full');
    }

    try {
      await wsClientRef.current.send(event, data, {
        retry: true,
        compress: compressionEnabled
      });
      
      if (monitoringEnabled) {
        setMetrics(prev => ({
          ...prev,
          messagesSent: prev.messagesSent + 1
        }));
      }
    } catch (error) {
      throw error;
    }
  }, [connectionState, messageQueue, messageQueueSize, compressionEnabled, monitoringEnabled]);

  // Event listener management
  const addListener = useCallback((event: string, callback: Function) => {
    wsClientRef.current?.on(event, callback);
  }, []);

  const removeListener = useCallback((event: string, callback: Function) => {
    wsClientRef.current?.off(event, callback);
  }, []);

  // Metrics and monitoring
  const updateMetrics = useCallback(() => {
    if (monitoringEnabled && connectionState === ConnectionState.CONNECTED) {
      setMetrics(prev => ({
        ...prev,
        uptime: Math.floor((Date.now() - startTimeRef.current) / 1000)
      }));
    }
  }, [monitoringEnabled, connectionState]);

  // Connection monitoring setup
  useEffect(() => {
    if (monitoringEnabled) {
      metricsIntervalRef.current = setInterval(updateMetrics, 1000);
    }

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [monitoringEnabled, updateMetrics]);

  // WebSocket event handlers setup
  useEffect(() => {
    const handleConnectionHealth = (data: { connected: boolean }) => {
      if (data.connected) {
        setMetrics(prev => ({
          ...prev,
          lastHeartbeat: Date.now()
        }));
      }
    };

    const handleError = () => {
      setConnectionState(ConnectionState.ERROR);
    };

    if (wsClientRef.current) {
      wsClientRef.current.on(WS_EVENTS.CONNECTION_HEALTH, handleConnectionHealth);
      wsClientRef.current.on(WS_EVENTS.ERROR, handleError);
    }

    return () => {
      if (wsClientRef.current) {
        wsClientRef.current.off(WS_EVENTS.CONNECTION_HEALTH, handleConnectionHealth);
        wsClientRef.current.off(WS_EVENTS.ERROR, handleError);
      }
    };
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Utility methods
  const getMetrics = useCallback(() => metrics, [metrics]);
  const clearMessageQueue = useCallback(() => setMessageQueue([]), []);
  const getPendingMessages = useCallback(() => messageQueue, [messageQueue]);

  return {
    isConnected: connectionState === ConnectionState.CONNECTED,
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