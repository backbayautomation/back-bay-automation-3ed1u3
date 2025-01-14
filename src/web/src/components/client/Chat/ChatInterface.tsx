/**
 * ChatInterface component providing a production-ready chat interface with real-time messaging
 * Features include rich content rendering, accessibility compliance, and error handling
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react'; // v18.2.0
import { useDispatch, useSelector } from 'react-redux'; // v8.1.0
import { Paper, Box } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

// Internal imports
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import useWebSocket from '../../../hooks/useWebSocket';
import { ChatSession, Message, ErrorState, WebSocketStatus } from '../../../types/chat';
import { addMessage, selectCurrentSession, selectWebSocketStatus } from '../../../redux/slices/chatSlice';
import { UI_CONSTANTS } from '../../../config/constants';

// Styled components with accessibility and responsive design
const ChatContainer = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: '600px',
  maxHeight: '800px',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
  position: 'relative',
  overflow: 'hidden',

  // Mobile responsiveness
  [theme.breakpoints.down('sm')]: {
    minHeight: '100vh',
    maxHeight: '100vh',
    borderRadius: 0,
  },

  // Focus management
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // Reduced motion support
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

const ErrorFallback = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  color: theme.palette.error.main,
  backgroundColor: theme.palette.error.light,
  borderRadius: theme.shape.borderRadius,
  margin: theme.spacing(2),
}));

// Interface definitions
interface ChatInterfaceProps {
  className?: string;
  sessionId: string;
  onError?: (error: ErrorState) => void;
  'aria-label'?: string;
}

/**
 * Main chat interface component with error handling and accessibility
 */
const ChatInterface = React.memo<ChatInterfaceProps>(({
  className,
  sessionId,
  onError,
  'aria-label': ariaLabel = 'Chat interface',
}) => {
  // Redux state management
  const dispatch = useDispatch();
  const currentSession = useSelector(selectCurrentSession);
  const wsStatus = useSelector(selectWebSocketStatus);

  // Local state management
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  // WebSocket connection management
  const {
    isConnected,
    connectionState,
    sendMessage,
    addListener,
    removeListener,
  } = useWebSocket({
    baseUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8080',
    token: sessionId,
    autoConnect: true,
    reconnectAttempts: 5,
    monitoringEnabled: true,
  });

  // Message handling
  const handleNewMessage = useCallback((message: Message) => {
    dispatch(addMessage(message));
  }, [dispatch]);

  const handleMessageSubmit = useCallback(async (content: string) => {
    if (!isConnected) {
      onError?.({
        type: 'connection',
        message: 'Connection lost. Please try again.',
        timestamp: new Date(),
        retryCount: 0,
      });
      return;
    }

    setIsLoading(true);
    try {
      await sendMessage('chat.message', {
        content,
        sessionId,
        timestamp: new Date(),
      });
    } catch (error) {
      onError?.({
        type: 'message',
        message: 'Failed to send message',
        timestamp: new Date(),
        retryCount: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sendMessage, sessionId, onError]);

  // Load more messages handler
  const handleLoadMore = useCallback(() => {
    if (currentSession?.messages.length) {
      // Implementation for loading previous messages
      setHasMoreMessages(false);
    }
  }, [currentSession]);

  // WebSocket event listeners
  useEffect(() => {
    addListener('chat.message', handleNewMessage);
    
    return () => {
      removeListener('chat.message', handleNewMessage);
    };
  }, [addListener, removeListener, handleNewMessage]);

  // Connection status monitoring
  useEffect(() => {
    if (connectionState === WebSocketStatus.DISCONNECTED) {
      onError?.({
        type: 'connection',
        message: 'Connection lost. Attempting to reconnect...',
        timestamp: new Date(),
        retryCount: 0,
      });
    }
  }, [connectionState, onError]);

  // Error boundary fallback
  const handleError = useCallback((error: Error) => {
    onError?.({
      type: 'system',
      message: error.message,
      timestamp: new Date(),
      retryCount: 0,
    });
  }, [onError]);

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <ErrorFallback role="alert">
          <h3>Something went wrong</h3>
          <pre>{error.message}</pre>
        </ErrorFallback>
      )}
      onError={handleError}
    >
      <ChatContainer
        className={className}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <MessageList
          isLoading={isLoading}
          onScrollTop={handleLoadMore}
          hasMoreMessages={hasMoreMessages}
        />
        <ChatInput
          chatSessionId={sessionId}
          onMessageSent={handleMessageSubmit}
          maxLength={UI_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH}
          enableMarkdown
          enableLatex
          offlineQueueEnabled
        />
      </ChatContainer>
    </ErrorBoundary>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;