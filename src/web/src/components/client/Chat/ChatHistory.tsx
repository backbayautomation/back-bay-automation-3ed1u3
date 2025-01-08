import React, { useCallback, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Box, Typography, IconButton, useMediaQuery, useTheme } from '@mui/material'; // ^5.14.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { motion, AnimatePresence } from 'framer-motion'; // ^10.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Internal imports
import { ChatSession } from '../../../types/chat';
import { selectSessions, selectCurrentSession } from '../../../redux/slices/chatSlice';
import ContentLoader from '../../common/Loaders/ContentLoader';

// Props interface
interface ChatHistoryProps {
  onSessionSelect: (session: ChatSession) => void;
  className?: string;
  isMobile?: boolean;
  onClose?: () => void;
}

// Custom hook for keyboard navigation
const useSessionNavigation = (sessions: ChatSession[]) => {
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, sessions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    }
  }, [sessions.length]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { focusedIndex, setFocusedIndex };
};

// Error Fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Box sx={styles.errorState}>
    <Typography variant="body1" color="error">
      Error loading chat history: {error.message}
    </Typography>
  </Box>
);

// Main component
const ChatHistory = React.memo<ChatHistoryProps>(({
  onSessionSelect,
  className,
  isMobile,
  onClose
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const sessions = useSelector(selectSessions);
  const currentSession = useSelector(selectCurrentSession);
  const parentRef = useRef<HTMLDivElement>(null);
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Virtual list setup
  const rowVirtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5
  });

  // Keyboard navigation setup
  const { focusedIndex, setFocusedIndex } = useSessionNavigation(sessions);

  // Session selection handler
  const handleSessionSelect = useCallback((session: ChatSession) => {
    onSessionSelect(session);
    if (isMobile && onClose) {
      onClose();
    }
  }, [onSessionSelect, isMobile, onClose]);

  // Render session item
  const renderSessionItem = useCallback((session: ChatSession, index: number) => {
    const isSelected = currentSession?.id === session.id;
    const isFocused = focusedIndex === index;

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2 }}
        key={session.id}
        role="option"
        aria-selected={isSelected}
        tabIndex={isFocused ? 0 : -1}
        onClick={() => handleSessionSelect(session)}
        onFocus={() => setFocusedIndex(index)}
        style={rowVirtualizer.getItemStyle(index)}
        sx={{
          ...styles.sessionItem,
          ...(isSelected && styles.selectedSession)
        }}
      >
        <Typography sx={styles.sessionTitle} noWrap>
          {session.title}
        </Typography>
        <Typography sx={styles.sessionDate} variant="caption">
          {new Date(session.createdAt).toLocaleDateString()}
        </Typography>
      </motion.div>
    );
  }, [currentSession, focusedIndex, handleSessionSelect, rowVirtualizer, setFocusedIndex]);

  const containerStyles = {
    ...(isMobile ? styles.mobileContainer : styles.historyContainer),
    ...(className && { className })
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        ref={parentRef}
        role="listbox"
        aria-label="Chat history"
        {...containerStyles}
      >
        {isMobile && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <IconButton
              edge="start"
              onClick={onClose}
              aria-label="Close chat history"
            >
              {isSmallScreen ? <ArrowBackIcon /> : <CloseIcon />}
            </IconButton>
          </Box>
        )}

        <AnimatePresence>
          {!sessions.length ? (
            <Box sx={styles.emptyState}>
              <Typography variant="body2">
                No chat history available
              </Typography>
            </Box>
          ) : (
            <Box
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: '100%',
                position: 'relative'
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualItem => (
                <React.Fragment key={virtualItem.key}>
                  {sessions[virtualItem.index] ? (
                    renderSessionItem(sessions[virtualItem.index], virtualItem.index)
                  ) : (
                    <ContentLoader height="72px" />
                  )}
                </React.Fragment>
              ))}
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </ErrorBoundary>
  );
});

// Styles
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
};

ChatHistory.displayName = 'ChatHistory';

export default ChatHistory;