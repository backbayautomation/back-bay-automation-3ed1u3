import React, { useCallback, useEffect } from 'react';
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

  // Mobile responsiveness
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },

  [theme.breakpoints.down('md')]: {
    height: `calc(100vh - ${theme.spacing(7)})`,
  },

  // Reduced motion support
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
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
  zIndex: theme.zIndex.modal,
}));

// WebSocket configuration
const WEBSOCKET_OPTIONS = {
  autoConnect: true,
  reconnectInterval: 3000,
  maxRetries: 5,
  pingInterval: 30000,
  pingTimeout: 5000,
  debug: false,
};

// Accessibility configuration
const ACCESSIBILITY_CONFIG = {
  ariaLabels: {
    chatContainer: 'Chat message container',
    messageInput: 'Type your message',
    sendButton: 'Send message',
    loadingState: 'Connecting to chat service',
  },
  keyboardShortcuts: {
    sendMessage: 'Ctrl + Enter',
    clearInput: 'Escape',
  },
};

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <Box
    role="alert"
    aria-live="assertive"
    p={3}
    color="error.main"
    bgcolor="error.light"
    borderRadius={1}
  >
    <h3>Something went wrong with the chat interface:</h3>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </Box>
);

/**
 * ChatPage component providing the main chat interface with real-time communication
 * and accessibility features
 */
const ChatPage = React.memo(() => {
  // WebSocket connection management
  const {
    isConnected,
    connectionState,
    connect,
    disconnect,
  } = useWebSocket({
    baseUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8080',
    token: 'session-token', // Replace with actual session token
    ...WEBSOCKET_OPTIONS,
  });

  // Initialize WebSocket connection
  useEffect(() => {
    connect().catch(console.error);
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle connection errors
  const handleError = useCallback((error: Error) => {
    console.error('Chat error:', error);
    // Implement error reporting/logging here
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset error state and reconnect
        connect().catch(console.error);
      }}
      onError={handleError}
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
              <CircularProgress size={48} thickness={4} />
            </LoadingOverlay>
          )}
          
          <ChatInterface
            sessionId="current-session-id" // Replace with actual session ID
            onError={handleError}
            aria-label="Product catalog chat interface"
          />
        </ChatPageContainer>
      </ClientLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
ChatPage.displayName = 'ChatPage';

export default ChatPage;