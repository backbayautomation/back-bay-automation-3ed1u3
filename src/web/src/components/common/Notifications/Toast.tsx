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
    exit: { opacity: 0, x: 50, y: 0 }
  },
  'top-left': {
    initial: { opacity: 0, x: -50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: -50, y: 0 }
  },
  'bottom-right': {
    initial: { opacity: 0, x: 50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 50, y: 0 }
  },
  'bottom-left': {
    initial: { opacity: 0, x: -50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: -50, y: 0 }
  }
};

// Toast positioning styles
const TOAST_POSITIONS = {
  'top-right': { top: '1.25rem', right: '1.25rem' },
  'top-left': { top: '1.25rem', left: '1.25rem' },
  'bottom-right': { bottom: '1.25rem', right: '1.25rem' },
  'bottom-left': { bottom: '1.25rem', left: '1.25rem' }
};

// Props interface for the Toast component
interface ToastProps {
  notification: NotificationState;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onDismiss: (id: string) => void;
}

/**
 * Toast notification component with accessibility and animation support
 */
const Toast = React.memo(({ notification, position, onDismiss }: ToastProps) => {
  const dispatch = useDispatch();
  const { id, type, message, duration = DEFAULT_TOAST_DURATION_MS, onClick } = notification;

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
    if (event.key === 'Escape') {
      handleDismiss();
    }
  }, [handleDismiss]);

  // Type-specific styling
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  // Type-specific icons
  const getTypeIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return null;
    }
  };

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      tabIndex={0}
      initial={ANIMATION_VARIANTS[position].initial}
      animate={ANIMATION_VARIANTS[position].animate}
      exit={ANIMATION_VARIANTS[position].exit}
      transition={{ duration: ANIMATION_DURATION_MS / 1000 }}
      style={TOAST_POSITIONS[position]}
      className={`fixed flex items-center w-full max-w-sm p-4 rounded-lg shadow-lg border ${getTypeStyles()} transform-gpu`}
      onClick={onClick || undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 mr-3">
        <span className="text-lg" aria-hidden="true">
          {getTypeIcon()}
        </span>
      </div>
      <div className="flex-grow text-sm font-medium">
        {message}
      </div>
      <button
        type="button"
        aria-label="Close notification"
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        className="inline-flex items-center justify-center w-8 h-8 ml-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
      >
        <span className="sr-only">Close</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
});

Toast.displayName = 'Toast';

export default Toast;