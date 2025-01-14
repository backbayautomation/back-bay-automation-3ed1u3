import React, { useCallback, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  useTheme,
  useMediaQuery,
  Divider,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChatIcon from '@mui/icons-material/Chat';
import { format } from 'date-fns';

import { ChatSession } from '../../../types/chat';
import { selectSessions, selectCurrentSession } from '../../../redux/slices/chatSlice';
import ContentLoader from '../../common/Loaders/ContentLoader';

interface ChatHistoryProps {
  onSessionSelect: (sessionId: string) => void;
  className?: string;
  isMobile?: boolean;
  onClose?: () => void;
}

// Custom hook for keyboard navigation
const useSessionNavigation = (sessions: ChatSession[]) => {
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!sessions.length) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, sessions.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        if (focusedIndex >= 0) {
          const session = sessions[focusedIndex];
          document.getElementById(`session-${session.id}`)?.click();
        }
        break;
    }
  }, [sessions, focusedIndex]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { focusedIndex, setFocusedIndex };
};

// Error Fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <Box sx={styles.errorState}>
    <Typography variant="body1" color="error">
      Error loading chat history: {error.message}
    </Typography>
    <IconButton onClick={resetErrorBoundary} aria-label="Retry loading chat history">
      <ChatIcon />
    </IconButton>
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
  const parentRef = useRef<HTMLDivElement>(null);
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const { focusedIndex, setFocusedIndex } = useSessionNavigation(sessions);

  const rowVirtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5
  });

  const containerStyles = {
    ...styles.historyContainer,
    ...(isMobile && styles.mobileContainer)
  };

  const handleSessionClick = useCallback((session: ChatSession) => {
    onSessionSelect(session.id);
    if (isMobile && onClose) {
      onClose();
    }
  }, [onSessionSelect, isMobile, onClose]);

  if (!sessions) {
    return (
      <Box sx={containerStyles} className={className}>
        <ContentLoader 
          height="100px"
          width="100%"
          ariaLabel="Loading chat history"
        />
      </Box>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        ref={parentRef}
        sx={containerStyles}
        className={className}
        role="complementary"
        aria-label="Chat history"
      >
        {isMobile && (
          <Box sx={styles.mobileHeader}>
            <Typography variant="h6">Chat History</Typography>
            <IconButton onClick={onClose} aria-label="Close chat history">
              <CloseIcon />
            </IconButton>
          </Box>
        )}

        {sessions.length === 0 ? (
          <Box sx={styles.emptyState}>
            <Typography variant="body1">No chat history yet</Typography>
          </Box>
        ) : (
          <List sx={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            <AnimatePresence>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const session = sessions[virtualRow.index];
                const isSelected = currentSession?.id === session.id;
                const isFocused = focusedIndex === virtualRow.index;

                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <ListItem
                      id={`session-${session.id}`}
                      button
                      onClick={() => handleSessionClick(session)}
                      sx={{
                        ...styles.sessionItem,
                        ...(isSelected && styles.selectedSession)
                      }}
                      tabIndex={isFocused ? 0 : -1}
                      aria-selected={isSelected}
                      onFocus={() => setFocusedIndex(virtualRow.index)}
                    >
                      <Box>
                        <Tooltip title={session.title} placement="top">
                          <Typography sx={styles.sessionTitle} noWrap>
                            {session.title}
                          </Typography>
                        </Tooltip>
                        <Typography sx={styles.sessionDate}>
                          {format(new Date(session.createdAt), 'MMM d, yyyy h:mm a')}
                        </Typography>
                      </Box>
                    </ListItem>
                    <Divider />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </List>
        )}
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
    bgcolor: 'background.paper'
  },
  mobileContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1200,
    bgcolor: 'background.paper'
  },
  mobileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    p: 2,
    borderBottom: '1px solid',
    borderColor: 'divider'
  },
  sessionItem: {
    borderBottom: '1px solid',
    borderColor: 'divider',
    minHeight: '72px',
    padding: '12px',
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '-2px'
    }
  },
  selectedSession: {
    bgcolor: 'action.selected',
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
    color: 'error.main',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2
  }
} as const;

export default ChatHistory;