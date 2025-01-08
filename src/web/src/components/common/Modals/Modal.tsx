import React, { useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material'; // @version 5.14.0
import { styled, useTheme } from '@mui/material/styles'; // @version 5.14.0
import CloseIcon from '@mui/icons-material/Close'; // @version 5.14.0

// Modal size constants
const MODAL_SIZES = {
  small: '400px',
  medium: '600px',
  large: '800px',
} as const;

// Z-index constants for stacking context
const Z_INDEX = {
  modal: 1300,
  modalBackdrop: 1200,
} as const;

// Animation duration constants
const ANIMATION_DURATION = {
  enter: 225,
  exit: 195,
} as const;

// Props interface with comprehensive accessibility options
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: keyof typeof MODAL_SIZES;
  fullWidth?: boolean;
  maxWidth?: boolean;
  ariaLabel?: string;
  ariaDescribedby?: string;
  disableBackdropClick?: boolean;
  disableEscapeKeyDown?: boolean;
  closeButtonAriaLabel?: string;
}

// Styled dialog component with responsive design and theme integration
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    fontFamily: theme.typography.fontFamily,
    padding: theme.spacing(2),
    margin: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[24],
    
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(1),
      padding: theme.spacing(1),
      width: `calc(100% - ${theme.spacing(2)})`,
      maxHeight: `calc(100% - ${theme.spacing(2)})`,
    },
    
    '&:focus': {
      outline: 'none',
    },
  },
  
  '& .MuiDialogTitle-root': {
    padding: theme.spacing(2),
    paddingRight: theme.spacing(6), // Space for close button
    '& h2': {
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    },
  },
  
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
    overflowY: 'auto',
    
    '&:first-child': {
      paddingTop: theme.spacing(2),
    },
  },
  
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1, 2),
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
  
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: Z_INDEX.modalBackdrop,
  },
}));

// Enhanced modal component with accessibility and responsive features
const Modal = React.memo<ModalProps>(({
  open,
  onClose,
  title,
  children,
  actions,
  size = 'medium',
  fullWidth = false,
  maxWidth = true,
  ariaLabel,
  ariaDescribedby,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
  closeButtonAriaLabel = 'Close modal',
}) => {
  const theme = useTheme();

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !disableBackdropClick) {
      onClose();
    }
  }, [disableBackdropClick, onClose]);

  // Handle escape key
  const handleEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !disableEscapeKeyDown) {
      onClose();
    }
  }, [disableEscapeKeyDown, onClose]);

  // Set up keyboard event listeners
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscapeKeyDown);
      return () => {
        document.removeEventListener('keydown', handleEscapeKeyDown);
      };
    }
  }, [open, handleEscapeKeyDown]);

  // Focus trap management
  useEffect(() => {
    if (open) {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const focusableElements = dialog.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
          (focusableElements[0] as HTMLElement).focus();
        }
      }
    }
  }, [open]);

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={ariaDescribedby}
      aria-label={ariaLabel}
      maxWidth={false}
      onClick={handleBackdropClick}
      TransitionProps={{
        timeout: {
          enter: ANIMATION_DURATION.enter,
          exit: ANIMATION_DURATION.exit,
        },
      }}
      sx={{
        zIndex: Z_INDEX.modal,
        '& .MuiDialog-paper': {
          width: fullWidth ? '100%' : MODAL_SIZES[size],
          maxWidth: maxWidth ? '100%' : undefined,
        },
      }}
    >
      {title && (
        <DialogTitle id="modal-title">
          {title}
          <IconButton
            aria-label={closeButtonAriaLabel}
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: theme.spacing(1),
              top: theme.spacing(1),
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
      )}
      
      <DialogContent dividers={!!title}>
        {children}
      </DialogContent>

      {actions && (
        <DialogActions>
          {actions}
        </DialogActions>
      )}
    </StyledDialog>
  );
});

Modal.displayName = 'Modal';

export default Modal;