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
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'
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
 * Enhanced WebSocket provider component with advanced features
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
  const wsClient = useRef<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [messageQueue, setMessageQueue] = useState<Message[]>([]);
  const heartbeatTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  /**
   * Enhanced connection handler with retry logic
   */
  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    try {
      setIsConnecting(true);
      setLastError(null);

      if (!wsClient.current) {
        wsClient.current = new WebSocketClient(baseUrl, token, {
          reconnectMaxAttempts: maxRetries,
          reconnectBaseDelay: retryDelay,
          heartbeatInterval,
          messageBufferSize: messageQueueSize
        });
      }

      await wsClient.current.connect();
      setIsConnected(true);
      setConnectionAttempts(0);
      processMessageQueue();
    } catch (error) {
      setLastError(error as Error);
      handleReconnection();
    } finally {
      setIsConnecting(false);
    }
  }, [baseUrl, token, maxRetries, retryDelay, heartbeatInterval, messageQueueSize]);

  /**
   * Enhanced disconnect handler with cleanup
   */
  const disconnect = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }

    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    if (wsClient.current) {
      wsClient.current.disconnect();
      wsClient.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setConnectionAttempts(0);
  }, []);

  /**
   * Enhanced message sender with queue support
   */
  const sendMessage = useCallback(async (event: string, data: any) => {
    if (!wsClient.current || !isConnected) {
      if (messageQueue.length < messageQueueSize) {
        setMessageQueue(prev => [...prev, { event, data } as Message]);
        return;
      }
      throw new Error('WebSocket disconnected and message queue full');
    }

    try {
      await wsClient.current.send(event, data, { retry: true });
    } catch (error) {
      setLastError(error as Error);
      throw error;
    }
  }, [isConnected, messageQueueSize]);

  /**
   * Enhanced event listener management
   */
  const addListener = useCallback((event: string, callback: Function) => {
    wsClient.current?.eventEmitter.on(event, callback);
  }, []);

  const removeListener = useCallback((event: string, callback: Function) => {
    wsClient.current?.eventEmitter.off(event, callback);
  }, []);

  /**
   * Enhanced message queue processor
   */
  const processMessageQueue = useCallback(async () => {
    if (!isConnected || messageQueue.length === 0) return;

    const queue = [...messageQueue];
    setMessageQueue([]);

    for (const message of queue) {
      try {
        await sendMessage(message.event as string, message.content);
      } catch (error) {
        setMessageQueue(prev => [...prev, message]);
        break;
      }
    }
  }, [isConnected, messageQueue, sendMessage]);

  /**
   * Enhanced reconnection handler with exponential backoff
   */
  const handleReconnection = useCallback(() => {
    if (connectionAttempts >= maxRetries) {
      setLastError(new Error('Max reconnection attempts reached'));
      return;
    }

    setConnectionAttempts(prev => prev + 1);
    const delay = Math.min(retryDelay * Math.pow(2, connectionAttempts), 30000);

    reconnectTimer.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connectionAttempts, maxRetries, retryDelay, connect]);

  /**
   * Initialize WebSocket connection
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
   * Enhanced context value with comprehensive state and methods
   */
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
    clearMessageQueue: () => setMessageQueue([]),
    getConnectionStatus: () => {
      if (isConnected) return ConnectionStatus.CONNECTED;
      if (isConnecting) return ConnectionStatus.CONNECTING;
      if (connectionAttempts > 0) return ConnectionStatus.RECONNECTING;
      return ConnectionStatus.DISCONNECTED;
    }
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