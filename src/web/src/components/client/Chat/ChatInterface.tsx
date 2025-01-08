import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from '@mui/material/styles';
import { Paper, Box } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import useWebSocket from '../../../hooks/useWebSocket';
import { ChatSession, Message, ErrorState } from '../../../types/chat';
import { addMessage, selectCurrentSession } from '../../../redux/slices/chatSlice';
import { VALIDATION_CONSTANTS } from '../../../config/constants';

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
  '@media (max-width: 600px)': {
    minHeight: '100vh',
    borderRadius: 0,
  },
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

const ErrorContainer = styled(Box)(({ theme }) => ({
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

// Constants
const ARIA_LABELS = {
  chat_region: 'Chat message area',
  message_input: 'Type your message',
  loading: 'Loading messages',
  error: 'Error in chat',
};

const ERROR_MESSAGES = {
  connection: 'Connection lost. Retrying...',
  message_failed: 'Failed to send message',
  generic: 'An error occurred',
};

const RETRY_CONFIG = {
  max_attempts: 3,
  delay_ms: 1000,
  backoff_factor: 1.5,
};

// Main component
const ChatInterface = React.memo<ChatInterfaceProps>(({
  className,
  sessionId,
  onError,
  'aria-label': ariaLabel = ARIA_LABELS.chat_region,
}) => {
  const dispatch = useDispatch();
  const currentSession = useSelector(selectCurrentSession);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const retryCountRef = useRef(0);

  // WebSocket setup with reconnection and error handling
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
    reconnectAttempts: RETRY_CONFIG.max_attempts,
    monitoringEnabled: true,
  });

  // Message handling
  const handleMessageSubmit = useCallback(async (content: string) => {
    if (!content.trim() || !isConnected) {
      return;
    }

    setIsLoading(true);
    try {
      await sendMessage('chat.message', {
        content,
        sessionId,
        metadata: {
          hasMarkdown: true,
          hasCodeBlock: content.includes('```'),
        },
      });
      retryCountRef.current = 0;
    } catch (error) {
      retryCountRef.current += 1;
      const shouldRetry = retryCountRef.current < RETRY_CONFIG.max_attempts;

      onError?.({
        type: 'message_send',
        message: ERROR_MESSAGES.message_failed,
        timestamp: new Date(),
        retryCount: retryCountRef.current,
      });

      if (shouldRetry) {
        const delay = RETRY_CONFIG.delay_ms * Math.pow(RETRY_CONFIG.backoff_factor, retryCountRef.current);
        setTimeout(() => handleMessageSubmit(content), delay);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sendMessage, sessionId, onError]);

  // WebSocket message listener
  useEffect(() => {
    const handleIncomingMessage = (message: Message) => {
      dispatch(addMessage(message));
    };

    addListener('chat.message', handleIncomingMessage);
    return () => removeListener('chat.message', handleIncomingMessage);
  }, [addListener, removeListener, dispatch]);

  // Connection state monitoring
  useEffect(() => {
    if (!isConnected) {
      onError?.({
        type: 'connection',
        message: ERROR_MESSAGES.connection,
        timestamp: new Date(),
        retryCount: retryCountRef.current,
      });
    }
  }, [isConnected, onError]);

  // Load more messages handler
  const handleLoadMore = useCallback(() => {
    if (currentSession?.messages.length && !isLoading) {
      setIsLoading(true);
      // Implementation for loading previous messages would go here
      setHasMoreMessages(false);
      setIsLoading(false);
    }
  }, [currentSession?.messages.length, isLoading]);

  // Error boundary fallback
  const handleError = useCallback((error: Error) => {
    onError?.({
      type: 'system',
      message: ERROR_MESSAGES.generic,
      timestamp: new Date(),
      retryCount: 0,
    });
    return (
      <ErrorContainer role="alert">
        {ERROR_MESSAGES.generic}
      </ErrorContainer>
    );
  }, [onError]);

  return (
    <ErrorBoundary FallbackComponent={({ error }) => handleError(error)}>
      <ChatContainer
        className={className}
        role="region"
        aria-label={ariaLabel}
        aria-busy={isLoading}
        data-testid="chat-interface"
      >
        <MessageList
          isLoading={isLoading}
          onScrollTop={handleLoadMore}
          hasMoreMessages={hasMoreMessages}
        />
        <ChatInput
          chatSessionId={sessionId}
          onMessageSent={handleMessageSubmit}
          maxLength={VALIDATION_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH}
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