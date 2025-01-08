import React, { useEffect, useCallback } from 'react';
import { Box, styled, CircularProgress } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import ClientLayout from '../../layouts/ClientLayout';
import ChatInterface from '../../components/client/Chat/ChatInterface';
import useWebSocket from '../../hooks/useWebSocket';

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
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
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

// WebSocket configuration options
const WEBSOCKET_OPTIONS = {
  autoConnect: true,
  reconnectInterval: 3000,
  maxRetries: 5,
  pingInterval: 30000,
  pingTimeout: 5000,
  debug: false
};

// Accessibility configuration
const ACCESSIBILITY_CONFIG = {
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
};

// Error fallback component
const ChatErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <Box
    role="alert"
    p={3}
    textAlign="center"
    color="error.main"
  >
    <h2>Chat Error</h2>
    <p>{error.message}</p>
    <button onClick={resetErrorBoundary}>Try Again</button>
  </Box>
);

/**
 * ChatPage component implementing the main chat interface for the client portal
 * with real-time communication, accessibility features, and error handling.
 */
const ChatPage = React.memo(() => {
  // Initialize WebSocket connection with configuration
  const {
    isConnected,
    connect,
    disconnect,
    connectionStatus
  } = useWebSocket({
    baseUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8080',
    token: sessionStorage.getItem('ws_token') || '',
    ...WEBSOCKET_OPTIONS
  });

  // Handle WebSocket connection on component mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle WebSocket errors
  const handleError = useCallback((error: Error) => {
    console.error('Chat WebSocket Error:', error);
    // Implement error reporting service integration here
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ChatErrorFallback}
      onError={handleError}
      onReset={() => connect()}
    >
      <ClientLayout>
        <ChatPageContainer
          role="main"
          aria-label={ACCESSIBILITY_CONFIG.ariaLabels.chatContainer}
        >
          {!isConnected && (
            <LoadingOverlay
              role="status"
              aria-label={ACCESSIBILITY_CONFIG.ariaLabels.loadingState}
            >
              <CircularProgress
                size={40}
                aria-hidden="true"
              />
            </LoadingOverlay>
          )}

          <ChatInterface
            sessionId={sessionStorage.getItem('chat_session_id') || ''}
            onError={handleError}
            aria-label="Chat interface"
          />
        </ChatPageContainer>
      </ClientLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
ChatPage.displayName = 'ChatPage';

export default ChatPage;