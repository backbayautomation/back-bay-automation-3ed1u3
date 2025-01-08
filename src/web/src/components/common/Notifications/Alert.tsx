import React from 'react'; // v18.2.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { Alert as MuiAlert } from '@mui/material'; // v5.14.0
import CloseIcon from '@mui/icons-material/Close'; // v5.14.0
import IconButton from '../Buttons/IconButton';

// Props interface with enhanced accessibility and customization options
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

// Styled wrapper with enhanced accessibility and responsiveness
const StyledAlert = styled(MuiAlert, {
  shouldForwardProp: (prop) => !['elevation'].includes(prop as string),
})(({ theme, elevation = 1 }) => ({
  position: 'relative',
  width: '100%',
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  boxShadow: elevation ? theme.shadows[elevation] : 'none',
  
  // Ensure proper color contrast for accessibility
  '& .MuiAlert-icon': {
    opacity: 0.9,
    marginRight: theme.spacing(1.5),
    padding: theme.spacing(0.5),
  },

  // Enhanced typography for better readability
  '& .MuiAlert-message': {
    padding: theme.spacing(1, 0),
    '& > *': {
      marginBottom: theme.spacing(0.5),
      '&:last-child': {
        marginBottom: 0,
      },
    },
  },

  // Responsive design adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.25, 1.5),
    '& .MuiAlert-icon': {
      padding: theme.spacing(0.25),
      marginRight: theme.spacing(1),
    },
  },

  // Focus visible styles for keyboard navigation
  '&:focus-visible': {
    outline: `3px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // Smooth transitions for visibility changes
  transition: theme.transitions.create(
    ['opacity', 'transform', 'box-shadow'],
    {
      duration: theme.transitions.duration.short,
    }
  ),

  // High contrast mode support
  '@media (prefers-contrast: more)': {
    border: '1px solid currentColor',
  },
}));

// Error boundary for the Alert component
class AlertErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Alert Error:', error, errorInfo);
  }

  render() {
    return this.props.children;
  }
}

// Main Alert component with memoization for performance
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

  // Action element with close button
  const action = dismissible && onClose ? (
    <IconButton
      size="small"
      color={severity}
      onClick={onClose}
      ariaLabel="Close alert"
      testId="alert-close-button"
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  ) : undefined;

  return (
    <AlertErrorBoundary>
      <StyledAlert
        severity={severity}
        elevation={elevation}
        role={role}
        action={action}
        onClose={onClose}
        aria-live={severity === 'error' ? 'assertive' : 'polite'}
        data-testid={`alert-${severity}`}
      >
        {title && (
          <div className="MuiAlert-title">
            <strong>{title}</strong>
          </div>
        )}
        <div>{message}</div>
      </StyledAlert>
    </AlertErrorBoundary>
  );
});

// Display name for debugging
Alert.displayName = 'Alert';

export default Alert;