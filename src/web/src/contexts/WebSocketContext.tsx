/**
 * WebSocket Context Provider for managing real-time communication
 * Version: 1.0.0
 * Dependencies:
 * - react: 18.2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketClient, WS_EVENTS } from '../api/websocket';
import { Message } from '../types/chat';

// Enhanced WebSocket context state interface
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
  getConnectionStatus: () => string;
}

// Enhanced provider props interface
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

// Create context with comprehensive type safety
const WebSocketContext = createContext<WebSocketContextState | null>(null);

// Enhanced WebSocket Provider component
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

  // Mutable refs for cleanup and state management
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced connection handler with retry logic
  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setLastError(null);

    try {
      if (!wsClientRef.current) {
        wsClientRef.current = new WebSocketClient(baseUrl, token, {
          reconnectMaxAttempts: maxRetries,
          heartbeatInterval,
          messageBufferSize: messageQueueSize
        });
      }

      // Set up connection state listeners
      wsClientRef.current.on(WS_EVENTS.CONNECTION_HEALTH, ({ connected }) => {
        setIsConnected(connected);
        setIsConnecting(false);
        if (connected) {
          setConnectionAttempts(0);
        }
      });

      // Handle connection errors
      wsClientRef.current.on(WS_EVENTS.ERROR, (error: Error) => {
        setLastError(error);
        setIsConnecting(false);
        setIsConnected(false);

        if (connectionAttempts < maxRetries) {
          setConnectionAttempts(prev => prev + 1);
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, retryDelay * Math.pow(2, connectionAttempts));
        }
      });

      await wsClientRef.current.connect();
    } catch (error) {
      setLastError(error as Error);
      setIsConnecting(false);
    }
  }, [baseUrl, token, maxRetries, heartbeatInterval, messageQueueSize, connectionAttempts, isConnecting, isConnected, retryDelay]);

  // Enhanced disconnect handler with cleanup
  const disconnect = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setConnectionAttempts(0);
  }, []);

  // Enhanced message sender with queue support
  const sendMessage = useCallback(async (event: string, data: any) => {
    if (!wsClientRef.current || !isConnected) {
      if (messageQueue.length < messageQueueSize) {
        setMessageQueue(prev => [...prev, { event, data } as Message]);
        return;
      }
      throw new Error('WebSocket not connected and message queue full');
    }

    try {
      await wsClientRef.current.send(event, data, { retry: true });
    } catch (error) {
      setLastError(error as Error);
      throw error;
    }
  }, [isConnected, messageQueue.length, messageQueueSize]);

  // Event listener management
  const addListener = useCallback((event: string, callback: Function) => {
    wsClientRef.current?.on(event, callback as any);
  }, []);

  const removeListener = useCallback((event: string, callback: Function) => {
    wsClientRef.current?.off(event, callback as any);
  }, []);

  // Message queue management
  const clearMessageQueue = useCallback(() => {
    setMessageQueue([]);
  }, []);

  // Connection status getter
  const getConnectionStatus = useCallback(() => {
    if (isConnected) return 'connected';
    if (isConnecting) return 'connecting';
    return 'disconnected';
  }, [isConnected, isConnecting]);

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Heartbeat monitoring effect
  useEffect(() => {
    if (isConnected) {
      heartbeatTimerRef.current = setInterval(() => {
        sendMessage(WS_EVENTS.CONNECTION_HEALTH, { timestamp: Date.now() })
          .catch(() => setIsConnected(false));
      }, heartbeatInterval);
    }

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [isConnected, heartbeatInterval, sendMessage]);

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

// Enhanced custom hook for accessing WebSocket context
export const useWebSocketContext = (): WebSocketContextState => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;