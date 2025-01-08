import React, { useRef, useEffect, useCallback } from 'react'; // ^18.2.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { styled } from '@mui/material/styles'; // ^5.14.0
import { Box } from '@mui/material'; // ^5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.11

import ChatBubble from './ChatBubble';
import { Message } from '../../../types/chat';
import { selectCurrentSession } from '../../../redux/slices/chatSlice';
import { useSelector } from 'react-redux';

// Props interface for MessageList component
interface MessageListProps {
  isLoading: boolean;
  onScrollTop: () => void;
  hasMoreMessages: boolean;
}

// Styled container for message list with enhanced scrolling and accessibility
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
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'light' 
      ? theme.palette.grey[300] 
      : theme.palette.grey[700],
    borderRadius: '4px',
  },
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  touchAction: 'manipulation',
  '@media (prefers-reduced-motion: reduce)': {
    scrollBehavior: 'auto',
  }
}));

// Custom hook for managing smooth scroll behavior
const useScrollToBottom = (containerRef: React.RefObject<HTMLDivElement>, shouldScroll: boolean) => {
  useEffect(() => {
    if (shouldScroll && containerRef.current) {
      const scrollContainer = containerRef.current;
      const scrollToBottom = () => {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
      };

      // Use requestAnimationFrame for smooth animation
      const animationFrame = requestAnimationFrame(scrollToBottom);
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [shouldScroll, containerRef]);
};

// Memoized MessageList component for optimal performance
const MessageList = React.memo<MessageListProps>(({
  isLoading,
  onScrollTop,
  hasMoreMessages
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
    overscan: 5
  });

  // Handle auto-scrolling
  useScrollToBottom(containerRef, isLoading || messages[messages.length - 1]?.role === 'assistant');

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (hasMoreMessages) {
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
    }
  }, [hasMoreMessages, onScrollTop]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Home') {
      containerRef.current?.scrollTo({ top: 0 });
    } else if (event.key === 'End') {
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
    }
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <Box p={2} color="error.main" role="alert">
          An error occurred while displaying messages. Please refresh the page.
        </Box>
      }
    >
      <MessageListContainer
        ref={containerRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="additions"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        data-testid="message-list"
      >
        {hasMoreMessages && (
          <Box role="status" aria-live="polite" p={1} textAlign="center">
            Scroll up to load more messages
          </Box>
        )}

        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = messages[virtualRow.index];
            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <ChatBubble
                  message={message}
                  isLoading={isLoading && virtualRow.index === messages.length - 1}
                />
              </div>
            );
          })}
        </div>

        {isLoading && (
          <Box role="status" aria-live="polite">
            <ChatBubble
              message={{
                id: 'loading',
                content: '',
                role: 'assistant',
                timestamp: new Date(),
                sessionId: currentSession?.id || '',
                metadata: { hasMarkdown: false, hasCodeBlock: false, codeLanguage: null, renderOptions: {
                  enableLatex: false,
                  enableDiagrams: false,
                  syntaxHighlighting: false
                }}
              }}
              isLoading={true}
            />
          </Box>
        )}
      </MessageListContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
MessageList.displayName = 'MessageList';

export default MessageList;