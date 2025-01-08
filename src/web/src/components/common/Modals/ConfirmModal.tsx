import React, { useCallback } from 'react';
import { Box, Typography } from '@mui/material'; // @version 5.14.0
import { Modal } from './Modal';
import { PrimaryButton } from '../Buttons/PrimaryButton';

// Color variants for different modal types
const VARIANT_COLORS = {
  warning: '#FFC107',
  error: '#DC3545',
  info: '#17A2B8',
  success: '#28A745',
} as const;

// Modal size definitions
const MODAL_SIZES = {
  small: '400px',
  medium: '600px',
  large: '800px',
} as const;

// Default text content
const DEFAULT_TEXTS = {
  confirm: 'Confirm',
  cancel: 'Cancel',
  close: 'Close Modal',
} as const;

export interface ConfirmModalProps {
  /** Controls modal visibility state */
  open: boolean;
  /** Handler for modal close events */
  onClose: () => void;
  /** Async handler for confirm action */
  onConfirm: () => Promise<void>;
  /** Modal title text */
  title: string;
  /** Confirmation message text */
  message: string;
  /** Custom text for confirm button */
  confirmText?: string;
  /** Custom text for cancel button */
  cancelText?: string;
  /** Visual variant affecting colors and emphasis */
  variant?: keyof typeof VARIANT_COLORS;
  /** Modal size affecting width */
  size?: keyof typeof MODAL_SIZES;
  /** Prevents closing modal on backdrop click */
  disableBackdropClick?: boolean;
  /** Loading state for confirm action */
  loading?: boolean;
}

/**
 * A reusable confirmation modal component with variant support and accessibility features.
 * Implements Material-UI design system with consistent styling and responsive design.
 */
export const ConfirmModal = React.memo<ConfirmModalProps>(({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = DEFAULT_TEXTS.confirm,
  cancelText = DEFAULT_TEXTS.cancel,
  variant = 'info',
  size = 'small',
  disableBackdropClick = false,
  loading = false,
}) => {
  // Handle confirm action with loading state
  const handleConfirm = useCallback(async () => {
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      // Error handling could be enhanced with a toast notification system
    }
  }, [onConfirm, onClose]);

  // Render modal actions
  const modalActions = (
    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
      <PrimaryButton
        variant="secondary"
        onClick={onClose}
        disabled={loading}
        aria-label={cancelText}
      >
        {cancelText}
      </PrimaryButton>
      <PrimaryButton
        variant="primary"
        onClick={handleConfirm}
        disabled={loading}
        aria-label={confirmText}
        sx={{
          backgroundColor: VARIANT_COLORS[variant],
          '&:hover': {
            backgroundColor: `${VARIANT_COLORS[variant]}CC`, // 80% opacity
          },
        }}
      >
        {confirmText}
      </PrimaryButton>
    </Box>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={modalActions}
      size={size}
      disableBackdropClick={disableBackdropClick || loading}
      ariaLabel={title}
      ariaDescribedby="confirm-modal-description"
    >
      <Box sx={{ minHeight: '100px', display: 'flex', alignItems: 'center' }}>
        <Typography
          id="confirm-modal-description"
          variant="body1"
          component="div"
          sx={{
            color: 'text.primary',
            textAlign: 'center',
            width: '100%',
          }}
        >
          {message}
        </Typography>
      </Box>
    </Modal>
  );
});

// Display name for debugging
ConfirmModal.displayName = 'ConfirmModal';

export default ConfirmModal;