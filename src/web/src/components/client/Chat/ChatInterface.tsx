/**
 * ChatInterface component implementing a production-ready chat interface with
 * real-time message exchange, accessibility compliance, and rich content rendering.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from '@mui/material/styles';
import { Paper, Box, Alert, Snackbar } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import useWebSocket from '../../../hooks/useWebSocket';
import { ChatSession, Message, ErrorState, WebSocketStatus } from '../../../types/chat';
import { selectCurrentSession, selectWebSocketStatus, addMessage } from '../../../redux/slices/chatSlice';
import { VALIDATION_CONSTANTS } from '../../../config/constants';

// Styled components
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
        borderRadius: 0
    },
    '&:focus': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: '2px'
    }
}));

const MessageContainer = styled(Box)(({ theme }) => ({
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    borderBottom: `1px solid ${theme.palette.divider}`
}));

// Props interface
interface ChatInterfaceProps {
    className?: string;
    sessionId: string;
    onError?: (error: ErrorState) => void;
    'aria-label'?: string;
}

/**
 * ChatInterface component with real-time messaging, accessibility, and error handling
 */
const ChatInterface = React.memo<ChatInterfaceProps>(({
    className,
    sessionId,
    onError,
    'aria-label': ariaLabel = 'Chat interface'
}) => {
    // Redux hooks
    const dispatch = useDispatch();
    const currentSession = useSelector(selectCurrentSession);
    const wsStatus = useSelector(selectWebSocketStatus);

    // State management
    const [isLoading, setIsLoading] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [error, setError] = useState<ErrorState | null>(null);
    const lastMessageRef = useRef<string | null>(null);

    // WebSocket connection
    const {
        isConnected,
        sendMessage,
        addListener,
        removeListener
    } = useWebSocket({
        baseUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8080',
        token: sessionStorage.getItem('ws_token') || '',
        autoConnect: true,
        reconnectAttempts: 5,
        monitoringEnabled: true
    });

    // Handle incoming messages
    const handleIncomingMessage = useCallback((message: Message) => {
        if (message.sessionId === sessionId) {
            dispatch(addMessage(message));
            lastMessageRef.current = message.id;
            setIsLoading(false);
        }
    }, [dispatch, sessionId]);

    // Handle message submission
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
                    hasMarkdown: content.includes('```') || content.includes('*'),
                    hasCodeBlock: content.includes('```'),
                    codeLanguage: null,
                    renderOptions: {
                        enableLatex: content.includes('$'),
                        enableDiagrams: content.includes('```mermaid'),
                        syntaxHighlighting: content.includes('```')
                    }
                }
            });
        } catch (err) {
            const errorState: ErrorState = {
                type: 'SEND_ERROR',
                message: 'Failed to send message',
                timestamp: new Date(),
                retryCount: 0
            };
            setError(errorState);
            onError?.(errorState);
            setIsLoading(false);
        }
    }, [isConnected, sendMessage, sessionId, onError]);

    // Load more messages
    const handleLoadMore = useCallback(async () => {
        if (isLoading || !currentSession) return;

        setIsLoading(true);
        try {
            // Implementation for loading previous messages
            setHasMoreMessages(currentSession.messages.length >= 50);
        } catch (err) {
            setError({
                type: 'LOAD_ERROR',
                message: 'Failed to load messages',
                timestamp: new Date(),
                retryCount: 0
            });
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, currentSession]);

    // Set up WebSocket listeners
    useEffect(() => {
        addListener('chat.message', handleIncomingMessage);
        return () => removeListener('chat.message', handleIncomingMessage);
    }, [addListener, removeListener, handleIncomingMessage]);

    // Error handling component
    const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
        <Box p={3} role="alert">
            <Alert 
                severity="error" 
                onClose={resetErrorBoundary}
                sx={{ mb: 2 }}
            >
                {error.message || 'An error occurred in the chat interface'}
            </Alert>
        </Box>
    );

    return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            <ChatContainer
                className={className}
                role="region"
                aria-label={ariaLabel}
                tabIndex={0}
            >
                <MessageContainer>
                    <MessageList
                        isLoading={isLoading}
                        onScrollTop={handleLoadMore}
                        hasMoreMessages={hasMoreMessages}
                    />
                </MessageContainer>

                <ChatInput
                    chatSessionId={sessionId}
                    onMessageSent={handleMessageSubmit}
                    maxLength={VALIDATION_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH}
                    enableMarkdown
                    enableLatex
                />

                <Snackbar
                    open={!!error}
                    autoHideDuration={6000}
                    onClose={() => setError(null)}
                >
                    <Alert 
                        severity="error" 
                        onClose={() => setError(null)}
                        sx={{ width: '100%' }}
                    >
                        {error?.message}
                    </Alert>
                </Snackbar>

                {wsStatus !== WebSocketStatus.CONNECTED && (
                    <Alert 
                        severity="warning"
                        sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}
                    >
                        Connection lost. Reconnecting...
                    </Alert>
                )}
            </ChatContainer>
        </ErrorBoundary>
    );
});

// Display name for debugging
ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;