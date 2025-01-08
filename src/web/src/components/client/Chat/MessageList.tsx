import React, { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { Box } from '@mui/material'; // v5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import ChatBubble from './ChatBubble';
import { Message } from '../../../types/chat';
import { selectCurrentSession } from '../../../redux/slices/chatSlice';
import { useSelector } from 'react-redux';

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
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: theme.palette.mode === 'light' 
      ? theme.palette.grey[200] 
      : theme.palette.grey[800],
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.mode === 'light'
      ? theme.palette.grey[400]
      : theme.palette.grey[600],
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'light'
        ? theme.palette.grey[500]
        : theme.palette.grey[500],
    },
  },
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  '@media (prefers-reduced-motion: reduce)': {
    scrollBehavior: 'auto',
  },
  touchAction: 'manipulation',
}));

interface MessageListProps {
  isLoading: boolean;
  onScrollTop: () => void;
  hasMoreMessages: boolean;
}

// Custom hook for managing scroll behavior
const useScrollToBottom = (containerRef: React.RefObject<HTMLDivElement>, shouldScroll: boolean) => {
  const scrollToBottom = useCallback(() => {
    if (containerRef.current && shouldScroll) {
      const { scrollHeight, clientHeight } = containerRef.current;
      const scrollTo = scrollHeight - clientHeight;
      
      containerRef.current.scrollTo({
        top: scrollTo,
        behavior: 'smooth',
      });
    }
  }, [containerRef, shouldScroll]);

  return scrollToBottom;
};

const MessageList = React.memo<MessageListProps>(({
  isLoading,
  onScrollTop,
  hasMoreMessages,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const currentSession = useSelector(selectCurrentSession);
  const messages = currentSession?.messages || [];

  // Set up virtualized list
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // Set up infinite scroll observer
  useEffect(() => {
    if (hasMoreMessages) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onScrollTop();
          }
        },
        { threshold: 0.1 }
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      observerRef.current = observer;

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }
  }, [hasMoreMessages, onScrollTop]);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useScrollToBottom(containerRef, messages.length > 0);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Home') {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (event.key === 'End') {
      scrollToBottom();
    }
  }, [scrollToBottom]);

  return (
    <ErrorBoundary
      fallback={
        <Box p={2} color="error.main">
          Error loading messages. Please refresh the page.
        </Box>
      }
    >
      <MessageListContainer
        ref={containerRef}
        role="log"
        aria-live="polite"
        aria-label="Chat message list"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        data-testid="message-list"
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          return (
            <ChatBubble
              key={message.id}
              message={message}
              isLoading={isLoading && virtualRow.index === messages.length - 1}
            />
          );
        })}
        
        {messages.length === 0 && !isLoading && (
          <Box
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              py: 4,
            }}
          >
            No messages yet. Start a conversation!
          </Box>
        )}
      </MessageListContainer>
    </ErrorBoundary>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;