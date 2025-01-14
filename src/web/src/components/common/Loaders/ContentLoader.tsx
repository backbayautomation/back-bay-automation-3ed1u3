import React from 'react'; // react@18.2.0
import { Skeleton, Box } from '@mui/material'; // @mui/material@5.14.0
import { styled, useTheme } from '@mui/material/styles'; // @mui/material/styles@5.14.0

// Interface for component props with comprehensive customization options
interface ContentLoaderProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
  ariaLabel?: string;
}

// Default props configuration
const DEFAULT_PROPS: Required<Omit<ContentLoaderProps, 'className'>> = {
  width: '100%',
  height: '100px',
  variant: 'rectangular',
  animation: 'pulse',
  ariaLabel: 'Content is loading...'
};

// Styled Skeleton component with theme integration and animation controls
const StyledSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'light' 
    ? theme.palette.grey[200] 
    : theme.palette.grey[800],
  transition: theme.transitions.create(['background-color'], {
    duration: theme.transitions.duration.standard
  }),
  // Respect user's motion preferences
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    transition: 'none'
  },
  // Ensure proper color contrast in both light and dark modes
  '&::after': {
    background: `linear-gradient(90deg, 
      transparent, 
      ${theme.palette.mode === 'light' 
        ? 'rgba(255, 255, 255, 0.4)' 
        : 'rgba(255, 255, 255, 0.1)'
      }, 
      transparent)`
  }
}));

/**
 * ContentLoader component provides loading placeholder animations with accessibility support
 * and theme-aware styling. It respects user preferences for reduced motion and ensures
 * proper color contrast in both light and dark modes.
 */
const ContentLoader = React.memo<ContentLoaderProps>(({
  width = DEFAULT_PROPS.width,
  height = DEFAULT_PROPS.height,
  variant = DEFAULT_PROPS.variant,
  animation = DEFAULT_PROPS.animation,
  className,
  ariaLabel = DEFAULT_PROPS.ariaLabel
}) => {
  const theme = useTheme();

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effectiveAnimation = prefersReducedMotion ? 'none' : animation;

  return (
    <Box
      className={className}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <StyledSkeleton
        variant={variant}
        width={width}
        height={height}
        animation={effectiveAnimation}
        aria-label={ariaLabel}
        sx={{
          borderRadius: variant === 'circular' 
            ? '50%' 
            : theme.shape.borderRadius
        }}
      />
    </Box>
  );
});

// Display name for debugging purposes
ContentLoader.displayName = 'ContentLoader';

export default ContentLoader;