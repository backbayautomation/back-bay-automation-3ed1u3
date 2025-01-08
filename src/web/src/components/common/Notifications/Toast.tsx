import React, { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import type { NotificationState } from '../../../redux/slices/uiSlice';
import { dismissNotification } from '../../../redux/slices/uiSlice';

// Animation constants
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
    initial: { opacity: 0, x: 50, y: 50 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 50, y: 50 }
  },
  'bottom-left': {
    initial: { opacity: 0, x: -50, y: 50 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: -50, y: 50 }
  }
};

// Position styles
const TOAST_POSITIONS = {
  'top-right': { top: 20, right: 20 },
  'top-left': { top: 20, left: 20 },
  'bottom-right': { bottom: 20, right: 20 },
  'bottom-left': { bottom: 20, left: 20 }
};

// Toast type styles
const TYPE_STYLES = {
  success: {
    bg: 'bg-green-100 dark:bg-green-800',
    border: 'border-green-500',
    text: 'text-green-800 dark:text-green-100',
    icon: '✓'
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-800',
    border: 'border-red-500',
    text: 'text-red-800 dark:text-red-100',
    icon: '✕'
  },
  warning: {
    bg: 'bg-yellow-100 dark:bg-yellow-800',
    border: 'border-yellow-500',
    text: 'text-yellow-800 dark:text-yellow-100',
    icon: '⚠'
  },
  info: {
    bg: 'bg-blue-100 dark:bg-blue-800',
    border: 'border-blue-500',
    text: 'text-blue-800 dark:text-blue-100',
    icon: 'ℹ'
  }
};

interface ToastProps {
  notification: NotificationState;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = React.memo(({ notification, position, onDismiss }) => {
  const dispatch = useDispatch();
  const { id, type, message, duration = DEFAULT_TOAST_DURATION_MS } = notification;

  // Memoized dismiss handler
  const handleDismiss = useCallback(() => {
    onDismiss(id);
    dispatch(dismissNotification(id));
  }, [id, onDismiss, dispatch]);

  // Auto-dismiss timer
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

  const typeStyle = TYPE_STYLES[type];
  const positionStyle = TOAST_POSITIONS[position];

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed z-50 min-w-[300px] max-w-[400px] ${typeStyle.bg}`}
      style={positionStyle}
      initial={ANIMATION_VARIANTS[position].initial}
      animate={ANIMATION_VARIANTS[position].animate}
      exit={ANIMATION_VARIANTS[position].exit}
      transition={{ duration: ANIMATION_DURATION_MS / 1000 }}
    >
      <div
        className={`flex items-center p-4 rounded-lg border ${typeStyle.border} shadow-lg`}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className={`flex-shrink-0 w-6 h-6 mr-2 flex items-center justify-center rounded-full ${typeStyle.text}`}>
          <span className="text-sm" aria-hidden="true">
            {typeStyle.icon}
          </span>
        </div>
        
        <div className={`flex-grow ${typeStyle.text}`}>
          <p className="text-sm font-medium">{message}</p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className={`ml-4 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 ${typeStyle.text} hover:opacity-75`}
          aria-label="Close notification"
        >
          <span className="sr-only">Close</span>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </motion.div>
  );
});

Toast.displayName = 'Toast';

export default Toast;