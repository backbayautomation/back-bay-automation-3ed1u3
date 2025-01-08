import React from 'react'; // ^18.2.0
import { Skeleton, Box } from '@mui/material'; // ^5.14.0
import { styled, useTheme } from '@mui/material/styles'; // ^5.14.0
import { lightTheme } from '../../../config/theme';

// Props interface for ContentLoader component
interface ContentLoaderProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
  animation?: 'pulse' | 'wave' | 'none';
  className?: string;
  ariaLabel?: string;
}

// Default props for consistent loading states
const DEFAULT_PROPS = {
  width: '100%',
  height: '100px',
  variant: 'rectangular' as const,
  animation: 'pulse' as const,
  ariaLabel: 'Content is loading...'
};

// Styled Skeleton component with theme integration and animation controls
const StyledSkeleton = styled(Skeleton)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'light' 
    ? theme.palette.grey[200] 
    : theme.palette.grey[800],
  transition: theme.transitions.create(['background-color']),
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    transition: 'none'
  }
}));

/**
 * ContentLoader component provides a loading placeholder with customizable dimensions,
 * animations, and full accessibility support.
 * 
 * @param {ContentLoaderProps} props - Component props
 * @returns {JSX.Element} Rendered loading placeholder
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
      role="progressbar"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <StyledSkeleton
        variant={variant}
        width={width}
        height={height}
        animation={effectiveAnimation}
        sx={{
          borderRadius: theme.shape.borderRadius,
          '&::after': {
            background: `linear-gradient(90deg, transparent, ${
              theme.palette.mode === 'light' 
                ? 'rgba(0, 0, 0, 0.04)' 
                : 'rgba(255, 255, 255, 0.04)'
            }, transparent)`
          }
        }}
      />
    </Box>
  );
});

// Display name for debugging
ContentLoader.displayName = 'ContentLoader';

export default ContentLoader;