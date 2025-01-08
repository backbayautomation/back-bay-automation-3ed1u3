import React, { useEffect, useCallback } from 'react'; // v18.2.0
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
 * LoadingButton component that extends PrimaryButton with loading state capabilities
 * while maintaining WCAG compliance and preventing multiple submissions.
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
  // Track loading state duration for potential timeout
  useEffect(() => {
    if (isLoading && loadingTimeout) {
      const timer = setTimeout(() => {
        // Reset loading state after timeout
        onClick?.(undefined as unknown as React.MouseEvent<HTMLButtonElement>);
      }, loadingTimeout);

      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingTimeout, onClick]);

  // Prevent interaction during loading state
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isLoading && onClick) {
      onClick(event);
    }
  }, [isLoading, onClick]);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Loading indicator component with proper size and color
  const LoadingIndicator = (
    <CircularProgress
      size={20}
      color="inherit"
      sx={{
        animation: prefersReducedMotion ? 'none' : undefined,
        position: 'absolute',
        ...(loadingPosition === 'start' && { left: '16px' }),
        ...(loadingPosition === 'end' && { right: '16px' }),
        ...(loadingPosition === 'center' && {
          left: '50%',
          transform: 'translateX(-50%)',
        }),
      }}
    />
  );

  return (
    <PrimaryButton
      {...props}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-live="polite"
      sx={{
        position: 'relative',
        ...props.sx,
        ...(isLoading && {
          pointerEvents: 'none',
          '& .MuiButton-startIcon, & .MuiButton-endIcon': {
            visibility: 'hidden',
          },
          ...(loadingPosition === 'start' && { paddingLeft: '44px' }),
          ...(loadingPosition === 'end' && { paddingRight: '44px' }),
          ...(loadingPosition === 'center' && {
            '& > *:not(.MuiCircularProgress-root)': {
              visibility: 'hidden',
            },
          }),
        }),
      }}
    >
      {isLoading && LoadingIndicator}
      {isLoading ? (
        <span aria-hidden="true">
          {loadingText}
        </span>
      ) : children}
      <span className="sr-only">
        {isLoading ? loadingText : children}
      </span>
    </PrimaryButton>
  );
});

// Display name for debugging
LoadingButton.displayName = 'LoadingButton';

export default LoadingButton;