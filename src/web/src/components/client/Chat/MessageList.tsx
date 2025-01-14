import React from 'react'; // react@18.2.0
import { useVirtualizer } from '@tanstack/react-virtual'; // @tanstack/react-virtual@3.0.0
import { styled } from '@mui/material/styles'; // @mui/material/styles@5.14.0
import { Box } from '@mui/material'; // @mui/material@5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // react-error-boundary@4.0.11
import { useSelector } from 'react-redux'; // react-redux@8.1.0

import ChatBubble from './ChatBubble';
import { Message } from '../../../types/chat';
import { selectCurrentSession } from '../../../redux/slices/chatSlice';

// Props interface with comprehensive options
interface MessageListProps {
  isLoading: boolean;
  onScrollTop: () => void;
  hasMoreMessages: boolean;
}

// Styled container with enhanced accessibility and scrolling behavior
const MessageListContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflowY: 'auto',
  padding: theme.spacing(2),
  gap: theme.spacing(2),
  scrollBehavior: 'smooth',
  position: 'relative',
  background: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  
  // Enhanced scrollbar styling
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.mode === 'light' 
      ? theme.palette.grey[200] 
      : theme.palette.grey[800],
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'light'
      ? theme.palette.grey[400]
      : theme.palette.grey[600],
    borderRadius: '4px',
    '&:hover': {
      background: theme.palette.mode === 'light'
        ? theme.palette.grey[500]
        : theme.palette.grey[500],
    },
  },

  // Focus management
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // Touch optimization
  '@media (hover: none)': {
    touchAction: 'manipulation',
  },

  // Reduced motion support
  '@media (prefers-reduced-motion: reduce)': {
    scrollBehavior: 'auto',
  },
}));

// Custom hook for managing scroll behavior
const useScrollToBottom = (
  containerRef: React.RefObject<HTMLDivElement>,
  shouldScroll: boolean
): (() => void) => {
  return React.useCallback(() => {
    if (!containerRef.current || !shouldScroll) return;

    const { scrollHeight, clientHeight } = containerRef.current;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll > 0) {
      containerRef.current.scrollTo({
        top: maxScroll,
        behavior: 'smooth',
      });
    }
  }, [containerRef, shouldScroll]);
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Box
    role="alert"
    p={2}
    bgcolor="error.main"
    color="error.contrastText"
    borderRadius={1}
  >
    <h3>Something went wrong displaying messages</h3>
    <pre>{error.message}</pre>
  </Box>
);

// Main component with performance optimizations
const MessageList = React.memo<MessageListProps>(({
  isLoading,
  onScrollTop,
  hasMoreMessages,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const currentSession = useSelector(selectCurrentSession);
  const messages = currentSession?.messages ?? [];

  // Virtual list configuration
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // Auto-scroll management
  const shouldAutoScroll = React.useRef(true);
  const scrollToBottom = useScrollToBottom(containerRef, shouldAutoScroll.current);

  // Scroll position tracking
  const handleScroll = React.useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    shouldAutoScroll.current = scrollHeight - scrollTop === clientHeight;
  }, []);

  // Infinite scroll setup
  React.useEffect(() => {
    if (!hasMoreMessages) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onScrollTop();
        }
      },
      { threshold: 0.1 }
    );

    const firstMessage = containerRef.current?.firstElementChild;
    if (firstMessage) {
      observerRef.current.observe(firstMessage);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMoreMessages, onScrollTop]);

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Keyboard navigation
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'End') {
      event.preventDefault();
      scrollToBottom();
    }
  }, [scrollToBottom]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <MessageListContainer
        ref={containerRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-label="Chat message history"
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          return (
            <ChatBubble
              key={message.id}
              message={message}
              isLoading={isLoading && virtualRow.index === messages.length - 1}
              className="message-item"
            />
          );
        })}
      </MessageListContainer>
    </ErrorBoundary>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;