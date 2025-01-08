import React from 'react';
import { Skeleton, Box } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';

// Props interface with comprehensive customization options
interface ContentLoaderProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
  ariaLabel?: string;
}

// Default props configuration
const DEFAULT_PROPS: ContentLoaderProps = {
  width: '100%',
  height: '100px',
  variant: 'rectangular',
  animation: 'pulse',
  ariaLabel: 'Content is loading...'
};

// Styled Skeleton component with theme integration and reduced motion support
const StyledSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'light' 
    ? theme.palette.grey[200] 
    : theme.palette.grey[800],
  transition: theme.transitions.create(['background-color']),
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    transition: 'none'
  },
  borderRadius: theme.shape.borderRadius,
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
 * and theme-aware styling. Respects user preferences for reduced motion.
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
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
      className={className}
      data-testid="content-loader"
    >
      <StyledSkeleton
        variant={variant}
        width={width}
        height={height}
        animation={effectiveAnimation}
        sx={{
          // Ensure proper color contrast in both light and dark modes
          backgroundColor: theme.palette.mode === 'light'
            ? theme.palette.grey[200]
            : theme.palette.grey[800]
        }}
      />
    </Box>
  );
});

// Display name for debugging purposes
ContentLoader.displayName = 'ContentLoader';

export default ContentLoader;