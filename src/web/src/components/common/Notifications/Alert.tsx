import React from 'react'; // v18.2.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { Alert as MuiAlert } from '@mui/material'; // v5.14.0
import CloseIcon from '@mui/icons-material/Close'; // v5.14.0
import IconButton from '../Buttons/IconButton';

// Props interface with comprehensive options for accessibility and customization
interface AlertProps {
  severity: 'success' | 'error' | 'warning' | 'info';
  message: string | React.ReactNode;
  title?: string;
  onClose?: () => void;
  autoHideDuration?: number;
  dismissible?: boolean;
  elevation?: number;
  role?: 'alert' | 'status';
}

// Styled component with enhanced accessibility and responsive design
const StyledAlert = styled(MuiAlert, {
  shouldForwardProp: (prop) => !['elevation'].includes(prop as string),
})<{ elevation?: number }>(({ theme, elevation = 1 }) => ({
  position: 'relative',
  width: '100%',
  boxSizing: 'border-box',
  marginBottom: theme.spacing(2),
  boxShadow: elevation ? theme.shadows[elevation] : 'none',
  borderRadius: theme.shape.borderRadius,
  
  // Ensure proper color contrast for WCAG compliance
  '& .MuiAlert-icon': {
    opacity: 0.9,
    marginRight: theme.spacing(2),
  },

  // Enhanced typography for better readability
  '& .MuiAlert-message': {
    padding: theme.spacing(1, 0),
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
  },

  // Proper spacing for the action area
  '& .MuiAlert-action': {
    marginRight: -theme.spacing(0.5),
    padding: theme.spacing(0, 1),
    alignItems: 'center',
  },

  // Responsive adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5, 2),
    '& .MuiAlert-icon': {
      marginRight: theme.spacing(1.5),
    },
  },

  // Smooth transitions for visibility changes
  transition: theme.transitions.create(['opacity', 'transform', 'box-shadow'], {
    duration: theme.transitions.duration.standard,
  }),

  // Focus visible indicator for keyboard navigation
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

// Main Alert component with error boundary protection
const Alert = React.memo<AlertProps>(({
  severity = 'info',
  message,
  title,
  onClose,
  autoHideDuration,
  dismissible = true,
  elevation = 1,
  role = 'alert',
}) => {
  // Auto-hide timer management
  React.useEffect(() => {
    if (autoHideDuration && onClose) {
      const timer = setTimeout(onClose, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [autoHideDuration, onClose]);

  // Memoized close button to prevent unnecessary re-renders
  const closeButton = React.useMemo(() => {
    if (!dismissible || !onClose) return null;
    
    return (
      <IconButton
        size="small"
        color="default"
        onClick={onClose}
        ariaLabel={`Close ${severity} alert`}
        testId={`alert-close-${severity}`}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    );
  }, [dismissible, onClose, severity]);

  // Enhanced error handling for message content
  const renderMessage = React.useMemo(() => {
    try {
      return (
        <>
          {title && (
            <div
              style={{ fontWeight: 'bold', marginBottom: '4px' }}
              role="heading"
              aria-level={2}
            >
              {title}
            </div>
          )}
          {message}
        </>
      );
    } catch (error) {
      console.error('Error rendering alert message:', error);
      return 'An error occurred displaying this alert';
    }
  }, [message, title]);

  return (
    <StyledAlert
      severity={severity}
      elevation={elevation}
      role={role}
      action={closeButton}
      aria-atomic="true"
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
      data-testid={`alert-${severity}`}
    >
      {renderMessage}
    </StyledAlert>
  );
});

// Display name for debugging
Alert.displayName = 'Alert';

export default Alert;