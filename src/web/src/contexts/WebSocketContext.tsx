/**
 * @fileoverview Enhanced WebSocket context provider for real-time communication
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'; // v18.2.0
import { WebSocketClient, WS_EVENTS } from '../api/websocket';
import { Message } from '../types/chat';

/**
 * Enhanced interface for WebSocket connection status
 */
enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error'
}

/**
 * Enhanced interface for WebSocket context state
 */
interface WebSocketContextState {
  isConnected: boolean;
  isConnecting: boolean;
  lastError: Error | null;
  connectionAttempts: number;
  messageQueue: Message[];
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (event: string, data: any) => Promise<void>;
  addListener: (event: string, callback: Function) => void;
  removeListener: (event: string, callback: Function) => void;
  clearMessageQueue: () => void;
  getConnectionStatus: () => ConnectionStatus;
}

/**
 * Enhanced interface for WebSocket provider props
 */
interface WebSocketProviderProps {
  children: React.ReactNode;
  baseUrl: string;
  token: string;
  autoConnect?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
}

// Create WebSocket context with enhanced error handling
const WebSocketContext = createContext<WebSocketContextState | null>(null);

/**
 * Enhanced WebSocket Provider component with advanced features
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  baseUrl,
  token,
  autoConnect = true,
  maxRetries = 5,
  retryDelay = 1000,
  heartbeatInterval = 30000,
  messageQueueSize = 100
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [messageQueue, setMessageQueue] = useState<Message[]>([]);

  const wsClientRef = useRef<WebSocketClient | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initialize WebSocket client with configuration
   */
  const initializeWebSocket = useCallback(() => {
    if (!wsClientRef.current) {
      wsClientRef.current = new WebSocketClient(baseUrl, token, {
        reconnectMaxAttempts: maxRetries,
        reconnectBaseDelay: retryDelay,
        heartbeatInterval,
        messageBufferSize: messageQueueSize
      });
    }
  }, [baseUrl, token, maxRetries, retryDelay, heartbeatInterval, messageQueueSize]);

  /**
   * Connect to WebSocket with enhanced error handling
   */
  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    try {
      setIsConnecting(true);
      initializeWebSocket();

      if (wsClientRef.current) {
        await wsClientRef.current.connect();
        setIsConnected(true);
        setConnectionAttempts(0);
        setLastError(null);
      }
    } catch (error) {
      setLastError(error as Error);
      setConnectionAttempts(prev => prev + 1);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, initializeWebSocket]);

  /**
   * Disconnect from WebSocket with cleanup
   */
  const disconnect = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
    }

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    setIsConnected(false);
    setIsConnecting(false);
    setLastError(null);
  }, []);

  /**
   * Send message with queue support
   */
  const sendMessage = useCallback(async (event: string, data: any) => {
    if (!wsClientRef.current || !isConnected) {
      if (messageQueue.length < messageQueueSize) {
        setMessageQueue(prev => [...prev, data as Message]);
      }
      throw new Error('WebSocket not connected');
    }

    try {
      await wsClientRef.current.send(event, data, { retry: true });
    } catch (error) {
      setLastError(error as Error);
      throw error;
    }
  }, [isConnected, messageQueue.length, messageQueueSize]);

  /**
   * Add event listener with type safety
   */
  const addListener = useCallback((event: string, callback: Function) => {
    if (wsClientRef.current) {
      wsClientRef.current.on(event, callback);
    }
  }, []);

  /**
   * Remove event listener with cleanup
   */
  const removeListener = useCallback((event: string, callback: Function) => {
    if (wsClientRef.current) {
      wsClientRef.current.off(event, callback);
    }
  }, []);

  /**
   * Clear message queue
   */
  const clearMessageQueue = useCallback(() => {
    setMessageQueue([]);
  }, []);

  /**
   * Get current connection status
   */
  const getConnectionStatus = useCallback((): ConnectionStatus => {
    if (isConnected) return ConnectionStatus.CONNECTED;
    if (isConnecting) return ConnectionStatus.CONNECTING;
    if (lastError) return ConnectionStatus.ERROR;
    return ConnectionStatus.DISCONNECTED;
  }, [isConnected, isConnecting, lastError]);

  /**
   * Setup connection health monitoring
   */
  useEffect(() => {
    if (isConnected && wsClientRef.current) {
      heartbeatTimerRef.current = setInterval(() => {
        wsClientRef.current?.send(WS_EVENTS.CONNECTION_HEALTH, { type: 'ping' }, { retry: false })
          .catch(() => setIsConnected(false));
      }, heartbeatInterval);
    }

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [isConnected, heartbeatInterval]);

  /**
   * Handle auto-connect functionality
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  const contextValue: WebSocketContextState = {
    isConnected,
    isConnecting,
    lastError,
    connectionAttempts,
    messageQueue,
    connect,
    disconnect,
    sendMessage,
    addListener,
    removeListener,
    clearMessageQueue,
    getConnectionStatus
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Enhanced custom hook for accessing WebSocket context
 */
export const useWebSocketContext = (): WebSocketContextState => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;