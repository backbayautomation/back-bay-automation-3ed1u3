import React from 'react'; // v18.2.0
import { CircularProgress } from '@mui/material'; // v5.14.0
import PrimaryButton, { PrimaryButtonProps } from './PrimaryButton';
import ContentLoader from '../Loaders/ContentLoader';

// Props interface extending PrimaryButtonProps with loading state capabilities
export interface LoadingButtonProps extends PrimaryButtonProps {
  /**
   * Flag indicating if button is in loading state
   */
  isLoading?: boolean;
  /**
   * Accessible text to announce loading state to screen readers
   * @default 'Loading...'
   */
  loadingText?: string;
  /**
   * Optional timeout in milliseconds for loading state
   */
  loadingTimeout?: number;
  /**
   * Position of loading indicator relative to button text
   * @default 'start'
   */
  loadingPosition?: 'start' | 'end' | 'center';
}

/**
 * LoadingButton component extending PrimaryButton with loading state capabilities.
 * Provides visual feedback during async operations while maintaining WCAG compliance.
 */
const LoadingButton = React.memo<LoadingButtonProps>(({
  children,
  isLoading = false,
  loadingText = 'Loading...',
  loadingTimeout,
  loadingPosition = 'start',
  disabled,
  onClick,
  ...props
}) => {
  // Track loading state for timeout handling
  const [internalLoading, setInternalLoading] = React.useState(isLoading);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  // Handle loading timeout if specified
  React.useEffect(() => {
    if (isLoading && loadingTimeout) {
      timeoutRef.current = setTimeout(() => {
        setInternalLoading(false);
      }, loadingTimeout);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, loadingTimeout]);

  // Update internal loading state when prop changes
  React.useEffect(() => {
    setInternalLoading(isLoading);
  }, [isLoading]);

  // Handle click during loading state
  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!internalLoading && onClick) {
      onClick(event);
    }
  }, [internalLoading, onClick]);

  // Calculate loading indicator position styles
  const getLoadingStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      color: 'inherit',
      width: 20,
      height: 20,
    };

    switch (loadingPosition) {
      case 'start':
        return { ...baseStyles, left: 16 };
      case 'end':
        return { ...baseStyles, right: 16 };
      case 'center':
        return {
          ...baseStyles,
          left: '50%',
          transform: 'translateX(-50%)',
        };
    }
  };

  // Calculate content padding based on loading position
  const getContentStyles = () => {
    if (!internalLoading) return {};
    
    switch (loadingPosition) {
      case 'start':
        return { paddingLeft: 44 };
      case 'end':
        return { paddingRight: 44 };
      case 'center':
        return { opacity: 0 };
    }
  };

  return (
    <PrimaryButton
      {...props}
      disabled={disabled || internalLoading}
      onClick={handleClick}
      aria-busy={internalLoading}
      aria-live="polite"
      sx={{
        position: 'relative',
        ...props.sx,
      }}
    >
      {internalLoading && (
        <CircularProgress
          size={20}
          sx={{
            ...getLoadingStyles(),
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
            },
          }}
          aria-hidden="true"
        />
      )}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          transition: 'padding 0.2s',
          ...getContentStyles(),
        }}
      >
        {internalLoading ? loadingText : children}
      </span>
    </PrimaryButton>
  );
});

LoadingButton.displayName = 'LoadingButton';

export default LoadingButton;