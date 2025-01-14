import React, { useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material'; // v5.14.0
import { styled, useTheme } from '@mui/material/styles'; // v5.14.0
import CloseIcon from '@mui/icons-material/Close'; // v5.14.0

// Modal size constants
const MODAL_SIZES = {
  small: '400px',
  medium: '600px',
  large: '800px',
} as const;

// Z-index configuration
const Z_INDEX = {
  modal: 1300,
  modalBackdrop: 1200,
} as const;

// Animation durations in ms
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

// Styled Dialog component with responsive design and theme integration
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    fontFamily: theme.typography.fontFamily,
    padding: theme.spacing(2),
    margin: theme.spacing(2),
    width: 'auto',
    maxHeight: `calc(100% - ${theme.spacing(4)})`,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[24],
    
    [theme.breakpoints.up('sm')]: {
      margin: theme.spacing(4),
      padding: theme.spacing(3),
    },
    
    '&[data-size="small"]': {
      maxWidth: MODAL_SIZES.small,
    },
    '&[data-size="medium"]': {
      maxWidth: MODAL_SIZES.medium,
    },
    '&[data-size="large"]': {
      maxWidth: MODAL_SIZES.large,
    },
  },
  
  '& .MuiDialogTitle-root': {
    padding: 0,
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  '& .MuiDialogContent-root': {
    padding: 0,
    overflowY: 'auto',
    marginBottom: theme.spacing(2),
  },
  
  '& .MuiDialogActions-root': {
    padding: 0,
    marginTop: theme.spacing(2),
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
    if (disableBackdropClick) {
      event.stopPropagation();
      return;
    }
    onClose();
  }, [disableBackdropClick, onClose]);

  // Handle escape key
  const handleEscapeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disableEscapeKeyDown) {
      event.stopPropagation();
      return;
    }
    onClose();
  }, [disableEscapeKeyDown, onClose]);

  // Focus trap management
  useEffect(() => {
    if (open) {
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          const modal = document.querySelector('[role="dialog"]');
          const focusableElements = modal?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          if (focusableElements) {
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.shiftKey && document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);
      return () => document.removeEventListener('keydown', handleTabKey);
    }
  }, [open]);

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      aria-labelledby={ariaLabel || 'modal-title'}
      aria-describedby={ariaDescribedby}
      onClick={handleBackdropClick}
      onKeyDown={handleEscapeKeyDown}
      data-size={size}
      fullWidth={fullWidth}
      maxWidth={maxWidth ? size : false}
      TransitionProps={{
        timeout: {
          enter: ANIMATION_DURATION.enter,
          exit: ANIMATION_DURATION.exit,
        },
      }}
      sx={{
        zIndex: Z_INDEX.modal,
        '& .MuiBackdrop-root': {
          zIndex: Z_INDEX.modalBackdrop,
        },
      }}
    >
      {title && (
        <DialogTitle id="modal-title">
          {title}
          <IconButton
            aria-label={closeButtonAriaLabel}
            onClick={onClose}
            size="large"
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
      
      <DialogContent>
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