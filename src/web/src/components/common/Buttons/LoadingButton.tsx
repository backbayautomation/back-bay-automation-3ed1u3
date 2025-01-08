// @mui/material version: 5.14.0
// react version: 18.2.0

import React, { useEffect, useCallback, useRef } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import PrimaryButton, { PrimaryButtonProps } from './PrimaryButton';
import ContentLoader from '../Loaders/ContentLoader';

// Styled wrapper for loading indicator positioning
const LoadingWrapper = styled(Box)(({ theme }) => ({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: theme.transitions.create(['opacity']),
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

// Props interface extending PrimaryButton props
export interface LoadingButtonProps extends PrimaryButtonProps {
  isLoading?: boolean;
  loadingText?: string;
  loadingTimeout?: number;
  loadingPosition?: 'start' | 'end' | 'center';
}

// Loading indicator sizes mapped to button sizes
const LOADING_SIZES = {
  small: 16,
  medium: 20,
  large: 24,
} as const;

// Loading indicator positions with spacing
const POSITION_STYLES = {
  start: { left: 16 },
  end: { right: 16 },
  center: { position: 'absolute', left: '50%', transform: 'translateX(-50%)' },
} as const;

const LoadingButton = React.memo<LoadingButtonProps>(({
  children,
  isLoading = false,
  loadingText = 'Loading...',
  loadingTimeout,
  loadingPosition = 'center',
  size = 'medium',
  disabled,
  onClick,
  ...props
}) => {
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>();

  // Handle loading timeout
  useEffect(() => {
    if (isLoading && loadingTimeout) {
      startTimeRef.current = Date.now();
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn(`Loading state exceeded timeout of ${loadingTimeout}ms`);
      }, loadingTimeout);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading, loadingTimeout]);

  // Track loading duration for analytics
  useEffect(() => {
    if (!isLoading && startTimeRef.current) {
      const duration = Date.now() - startTimeRef.current;
      // Analytics tracking could be added here
      startTimeRef.current = undefined;
    }
  }, [isLoading]);

  // Prevent multiple clicks during loading
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isLoading && onClick) {
      onClick(event);
    }
  }, [isLoading, onClick]);

  // Calculate loading indicator size based on button size
  const loadingSize = LOADING_SIZES[size];

  // Determine if reduced motion is preferred
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <PrimaryButton
      {...props}
      size={size}
      disabled={disabled || isLoading}
      onClick={handleClick}
      sx={{
        position: 'relative',
        ...props.sx,
        ...(isLoading && {
          '& .MuiButton-startIcon, & .MuiButton-endIcon': {
            opacity: 0,
          },
        }),
      }}
      aria-busy={isLoading}
      aria-live="polite"
      aria-label={isLoading ? loadingText : undefined}
    >
      {isLoading && (
        <LoadingWrapper
          sx={{
            ...POSITION_STYLES[loadingPosition],
            opacity: isLoading ? 1 : 0,
          }}
        >
          {prefersReducedMotion ? (
            <ContentLoader
              width={loadingSize}
              height={loadingSize}
              variant="circular"
              animation="none"
              ariaLabel={loadingText}
            />
          ) : (
            <CircularProgress
              size={loadingSize}
              color="inherit"
              aria-hidden="true"
              sx={{
                color: 'inherit',
                position: 'absolute',
              }}
            />
          )}
        </LoadingWrapper>
      )}
      <Box
        sx={{
          opacity: isLoading ? 0 : 1,
          transition: (theme) =>
            theme.transitions.create(['opacity'], {
              duration: prefersReducedMotion ? 0 : theme.transitions.duration.short,
            }),
        }}
      >
        {children}
      </Box>
    </PrimaryButton>
  );
});

LoadingButton.displayName = 'LoadingButton';

export default LoadingButton;