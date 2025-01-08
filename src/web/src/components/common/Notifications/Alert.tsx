import React, { useEffect, useCallback } from 'react';
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

// Styled component with enhanced accessibility and responsiveness
const StyledAlert = styled(MuiAlert, {
  shouldForwardProp: (prop) => 
    !['elevation', 'dismissible'].includes(prop as string),
})<{ elevation?: number; dismissible?: boolean }>(({ theme, elevation = 0, dismissible }) => ({
  // Proper spacing and layout
  padding: theme.spacing(1.5, 2),
  marginBottom: theme.spacing(2),
  
  // Elevation and shadows
  boxShadow: elevation ? theme.shadows[elevation] : 'none',
  
  // Enhanced visibility and contrast
  '& .MuiAlert-icon': {
    color: 'inherit',
    opacity: 0.9,
    marginRight: theme.spacing(2),
  },
  
  // Title styling
  '& .MuiAlert-message': {
    padding: 0,
    '& > h6': {
      margin: 0,
      marginBottom: theme.spacing(0.5),
      fontWeight: theme.typography.fontWeightMedium,
    },
  },
  
  // Proper spacing for dismissible alerts
  ...(dismissible && {
    paddingRight: theme.spacing(1),
  }),
  
  // Focus visible indicators
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  
  // Responsive design adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1, 1.5),
    '& .MuiAlert-icon': {
      marginRight: theme.spacing(1.5),
    },
  },
  
  // Smooth transitions
  transition: theme.transitions.create(
    ['box-shadow', 'background-color', 'transform'],
    {
      duration: theme.transitions.duration.short,
    }
  ),
}));

// Error boundary for graceful failure handling
class AlertErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <MuiAlert severity="error" role="alert">
          An error occurred while displaying this alert.
        </MuiAlert>
      );
    }
    return this.props.children;
  }
}

// Main component implementation with comprehensive accessibility features
const Alert: React.FC<AlertProps> = React.memo(({
  severity,
  message,
  title,
  onClose,
  autoHideDuration,
  dismissible = true,
  elevation = 0,
  role = 'alert',
}) => {
  // Auto-hide functionality
  useEffect(() => {
    if (autoHideDuration && onClose) {
      const timer = setTimeout(onClose, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [autoHideDuration, onClose]);

  // Memoized close handler
  const handleClose = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Keyboard interaction handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <AlertErrorBoundary>
      <StyledAlert
        severity={severity}
        elevation={elevation}
        dismissible={dismissible}
        role={role}
        onKeyDown={handleKeyDown}
        action={
          dismissible && onClose ? (
            <IconButton
              size="small"
              color={severity}
              onClick={handleClose}
              ariaLabel={`Close ${severity} alert`}
              testId={`alert-close-${severity}`}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          ) : null
        }
      >
        {title && (
          <h6>{title}</h6>
        )}
        {message}
      </StyledAlert>
    </AlertErrorBoundary>
  );
});

Alert.displayName = 'Alert';

export default Alert;