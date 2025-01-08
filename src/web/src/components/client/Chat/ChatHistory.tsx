import React, { useCallback, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Box, Typography, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import CloseIcon from '@mui/icons-material/Close';
import { format } from 'date-fns';

import { ChatSession } from '../../../types/chat';
import { selectSessions, selectCurrentSession } from '../../../redux/slices/chatSlice';
import ContentLoader from '../../common/Loaders/ContentLoader';

interface ChatHistoryProps {
  onSessionSelect: (session: ChatSession) => void;
  className?: string;
  isMobile?: boolean;
  onClose?: () => void;
}

// Custom hook for keyboard navigation
const useSessionNavigation = (sessions: ChatSession[]) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!ref.current) return;

    const focusedElement = document.activeElement as HTMLElement;
    const sessionElements = ref.current.querySelectorAll('[role="listitem"]');
    const currentIndex = Array.from(sessionElements).indexOf(focusedElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < sessionElements.length - 1) {
          (sessionElements[currentIndex + 1] as HTMLElement).focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          (sessionElements[currentIndex - 1] as HTMLElement).focus();
        }
        break;
    }
  }, []);

  React.useEffect(() => {
    const element = ref.current;
    if (element) {
      element.addEventListener('keydown', handleKeyDown);
      return () => element.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  return ref;
};

// Error Fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Box sx={styles.errorState}>
    <Typography variant="body1" color="error">
      Error loading chat history: {error.message}
    </Typography>
  </Box>
);

const ChatHistory = React.memo<ChatHistoryProps>(({
  onSessionSelect,
  className,
  isMobile = false,
  onClose
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const sessions = useSelector(selectSessions);
  const currentSession = useSelector(selectCurrentSession);
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const parentRef = useRef<HTMLDivElement>(null);
  const navigationRef = useSessionNavigation(sessions);

  // Virtual list configuration
  const rowVirtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5
  });

  // Memoized container styles
  const containerStyles = useMemo(() => ({
    ...styles.historyContainer,
    ...(isMobile && styles.mobileContainer)
  }), [isMobile]);

  // Session item renderer
  const renderSession = useCallback((session: ChatSession, index: number) => {
    const isSelected = currentSession?.id === session.id;
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2 }}
        role="listitem"
        tabIndex={0}
        onClick={() => onSessionSelect(session)}
        onKeyPress={(e) => e.key === 'Enter' && onSessionSelect(session)}
        style={{
          ...styles.sessionItem,
          ...(isSelected && styles.selectedSession),
          height: `${rowVirtualizer.getVirtualItems()[index].size}px`,
          transform: `translateY(${rowVirtualizer.getVirtualItems()[index].start}px)`
        }}
        aria-selected={isSelected}
        data-testid={`chat-session-${session.id}`}
      >
        <Typography sx={styles.sessionTitle} noWrap>
          {session.title}
        </Typography>
        <Typography sx={styles.sessionDate} variant="caption">
          {format(new Date(session.createdAt), 'MMM d, yyyy h:mm a')}
        </Typography>
      </motion.div>
    );
  }, [currentSession, onSessionSelect, rowVirtualizer]);

  if (!sessions) {
    return <ContentLoader height="100%" />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        ref={navigationRef}
        component="nav"
        aria-label="Chat history"
        sx={containerStyles}
        className={className}
      >
        {isMobile && (
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton
              onClick={onClose}
              aria-label="Close chat history"
              size="large"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        )}

        <Box
          ref={parentRef}
          role="list"
          style={{ height: '100%', overflow: 'auto' }}
          aria-live="polite"
        >
          <AnimatePresence>
            {sessions.length > 0 ? (
              rowVirtualizer.getVirtualItems().map((virtualRow) => (
                renderSession(sessions[virtualRow.index], virtualRow.index)
              ))
            ) : (
              <Typography sx={styles.emptyState}>
                No chat history available
              </Typography>
            )}
          </AnimatePresence>
        </Box>
      </Box>
    </ErrorBoundary>
  );
});

ChatHistory.displayName = 'ChatHistory';

const styles = {
  historyContainer: {
    height: '100%',
    overflowY: 'auto',
    borderRight: '1px solid',
    borderColor: 'divider',
    position: 'relative',
    transition: 'all 0.3s ease',
    width: { xs: '100%', sm: '320px' }
  },
  mobileContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1200,
    backgroundColor: 'background.paper'
  },
  sessionItem: {
    borderBottom: '1px solid',
    borderColor: 'divider',
    minHeight: '72px',
    padding: '12px',
    cursor: 'pointer',
    position: 'absolute',
    left: 0,
    right: 0,
    '&:hover': {
      backgroundColor: 'action.hover'
    },
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '-2px'
    }
  },
  selectedSession: {
    backgroundColor: 'action.selected',
    borderLeft: '4px solid',
    borderLeftColor: 'primary.main'
  },
  sessionTitle: {
    fontWeight: 'medium',
    color: 'text.primary',
    fontSize: {
      xs: '0.875rem',
      sm: '1rem'
    }
  },
  sessionDate: {
    color: 'text.secondary',
    fontSize: '0.875rem'
  },
  emptyState: {
    padding: '16px',
    textAlign: 'center',
    color: 'text.secondary'
  },
  errorState: {
    padding: '16px',
    textAlign: 'center',
    color: 'error.main'
  }
} as const;

export default ChatHistory;