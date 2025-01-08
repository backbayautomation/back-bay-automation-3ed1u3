import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, styled } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import ClientLayout from '../../layouts/ClientLayout';
import ChatInterface from '../../components/client/Chat/ChatInterface';
import useWebSocket from '../../hooks/useWebSocket';
import { WEBSOCKET_OPTIONS, ACCESSIBILITY_CONFIG } from './constants';

// Styled components with accessibility and responsive design
const ChatPageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: `calc(100vh - ${theme.spacing(8)})`,
  padding: theme.spacing(3),
  gap: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  overflow: 'hidden',
  '@media (max-width: theme.breakpoints.values.sm)': {
    padding: theme.spacing(1)
  },
  '@media (max-width: theme.breakpoints.values.md)': {
    height: `calc(100vh - ${theme.spacing(7)})`
  }
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  zIndex: theme.zIndex.modal
}));

// Error boundary fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Box
    role="alert"
    sx={{
      p: 3,
      color: 'error.main',
      textAlign: 'center'
    }}
  >
    <h2>Chat Error</h2>
    <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
  </Box>
);

// Main chat page component
const ChatPage = React.memo(() => {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize WebSocket connection with configuration
  const {
    isConnected,
    connectionState,
    connect,
    disconnect
  } = useWebSocket({
    baseUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8080',
    token: sessionId,
    autoConnect: WEBSOCKET_OPTIONS.autoConnect,
    reconnectAttempts: WEBSOCKET_OPTIONS.maxRetries,
    reconnectInterval: WEBSOCKET_OPTIONS.reconnectInterval,
    messageQueueSize: 100,
    monitoringEnabled: true
  });

  // Handle WebSocket connection lifecycle
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await connect();
      } catch (error) {
        console.error('WebSocket connection failed:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeConnection();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle error states
  const handleError = useCallback((error: { type: string; message: string }) => {
    console.error('Chat error:', error);
    // Additional error handling logic could be added here
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ClientLayout>
        <ChatPageContainer
          role="main"
          aria-label={ACCESSIBILITY_CONFIG.ariaLabels.chatContainer}
        >
          {isInitializing && (
            <LoadingOverlay
              role="status"
              aria-label={ACCESSIBILITY_CONFIG.ariaLabels.loadingState}
            >
              <CircularProgress />
            </LoadingOverlay>
          )}
          
          <ChatInterface
            sessionId={sessionId}
            onError={handleError}
            aria-label={ACCESSIBILITY_CONFIG.ariaLabels.chatContainer}
          />
        </ChatPageContainer>
      </ClientLayout>
    </ErrorBoundary>
  );
});

// Constants for component configuration
const constants = {
  WEBSOCKET_OPTIONS: {
    autoConnect: true,
    reconnectInterval: 3000,
    maxRetries: 5,
    pingInterval: 30000,
    pingTimeout: 5000,
    debug: false
  },
  ACCESSIBILITY_CONFIG: {
    ariaLabels: {
      chatContainer: 'Chat message container',
      messageInput: 'Type your message',
      sendButton: 'Send message',
      loadingState: 'Connecting to chat service'
    },
    keyboardShortcuts: {
      sendMessage: 'Ctrl + Enter',
      clearInput: 'Escape'
    }
  }
} as const;

// Display name for debugging
ChatPage.displayName = 'ChatPage';

export default ChatPage;