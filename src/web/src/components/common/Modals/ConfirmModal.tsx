import React, { useCallback } from 'react';
import { Box, Typography } from '@mui/material'; // @version 5.14.0
import Modal from './Modal';
import PrimaryButton from '../Buttons/PrimaryButton';

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
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: keyof typeof VARIANT_COLORS;
  size?: keyof typeof MODAL_SIZES;
  disableBackdropClick?: boolean;
  loading?: boolean;
}

const ConfirmModal = React.memo<ConfirmModalProps>(({
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
    } catch (error) {
      console.error('Confirmation action failed:', error);
      // Error handling could be enhanced based on requirements
    }
  }, [onConfirm]);

  // Handle cancel action
  const handleCancel = useCallback(() => {
    if (!loading) {
      onClose();
    }
  }, [loading, onClose]);

  // Render action buttons
  const renderActions = () => (
    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
      <PrimaryButton
        variant="secondary"
        onClick={handleCancel}
        disabled={loading}
        aria-label={cancelText}
      >
        {cancelText}
      </PrimaryButton>
      <PrimaryButton
        variant="primary"
        onClick={handleConfirm}
        disabled={loading}
        loading={loading}
        sx={{
          backgroundColor: VARIANT_COLORS[variant],
          '&:hover': {
            backgroundColor: VARIANT_COLORS[variant],
            opacity: 0.9,
          },
        }}
        aria-label={confirmText}
      >
        {confirmText}
      </PrimaryButton>
    </Box>
  );

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={title}
      actions={renderActions()}
      size={size}
      disableBackdropClick={disableBackdropClick || loading}
      disableEscapeKeyDown={loading}
      ariaLabel={title}
      ariaDescribedby="confirm-modal-description"
      closeButtonAriaLabel={DEFAULT_TEXTS.close}
    >
      <Box
        id="confirm-modal-description"
        sx={{
          minHeight: '100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="body1"
          component="div"
          sx={{
            color: 'text.primary',
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message}
        </Typography>
      </Box>
    </Modal>
  );
});

// Display name for development tooling
ConfirmModal.displayName = 'ConfirmModal';

export default ConfirmModal;