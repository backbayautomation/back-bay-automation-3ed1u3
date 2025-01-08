import React, { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { NotificationState, dismissNotification } from '../../../redux/slices/uiSlice';

// Constants for animation and timing
const ANIMATION_DURATION_MS = 200;
const DEFAULT_TOAST_DURATION_MS = 5000;

// Animation variants for different positions
const ANIMATION_VARIANTS = {
  'top-right': {
    initial: { opacity: 0, x: 50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 50, transition: { duration: ANIMATION_DURATION_MS / 1000 } }
  },
  'top-left': {
    initial: { opacity: 0, x: -50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: -50, transition: { duration: ANIMATION_DURATION_MS / 1000 } }
  },
  'bottom-right': {
    initial: { opacity: 0, x: 50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 50, transition: { duration: ANIMATION_DURATION_MS / 1000 } }
  },
  'bottom-left': {
    initial: { opacity: 0, x: -50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: -50, transition: { duration: ANIMATION_DURATION_MS / 1000 } }
  }
};

// Position styles for different toast positions
const TOAST_POSITIONS = {
  'top-right': { top: 20, right: 20 },
  'top-left': { top: 20, left: 20 },
  'bottom-right': { bottom: 20, right: 20 },
  'bottom-left': { bottom: 20, left: 20 }
};

// Toast component props interface
interface ToastProps {
  notification: NotificationState;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onDismiss: (id: string) => void;
}

/**
 * Toast notification component with accessibility and animation support
 */
const Toast: React.FC<ToastProps> = React.memo(({ notification, position, onDismiss }) => {
  const dispatch = useDispatch();
  const { id, type, message, duration = DEFAULT_TOAST_DURATION_MS } = notification;

  // Memoized dismiss handler
  const handleDismiss = useCallback(() => {
    onDismiss(id);
    dispatch(dismissNotification(id));
  }, [dispatch, id, onDismiss]);

  // Auto-dismiss effect
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleDismiss]);

  // Keyboard event handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      handleDismiss();
    }
  }, [handleDismiss]);

  // Get icon and background color based on notification type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: '✓',
          background: 'var(--color-success, #4CAF50)',
          iconColor: 'white'
        };
      case 'error':
        return {
          icon: '✕',
          background: 'var(--color-error, #DC3545)',
          iconColor: 'white'
        };
      case 'warning':
        return {
          icon: '!',
          background: 'var(--color-warning, #FFC107)',
          iconColor: 'black'
        };
      case 'info':
        return {
          icon: 'i',
          background: 'var(--color-info, #17A2B8)',
          iconColor: 'white'
        };
      default:
        return {
          icon: 'i',
          background: 'var(--color-info, #17A2B8)',
          iconColor: 'white'
        };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        ...TOAST_POSITIONS[position],
        zIndex: 9999
      }}
      initial={ANIMATION_VARIANTS[position].initial}
      animate={ANIMATION_VARIANTS[position].animate}
      exit={ANIMATION_VARIANTS[position].exit}
      layout
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          minWidth: '300px',
          maxWidth: '500px',
          padding: '12px 16px',
          background: typeStyles.background,
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          color: 'white',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            marginRight: '12px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            color: typeStyles.iconColor,
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          {typeStyles.icon}
        </span>
        <span style={{ flex: 1 }}>{message}</span>
        <button
          onClick={handleDismiss}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            marginLeft: '12px',
            padding: 0,
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            opacity: 0.7,
            transition: 'opacity 0.2s'
          }}
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
});

Toast.displayName = 'Toast';

export default Toast;