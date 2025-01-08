import React from 'react'; // ^18.2.0
import { Box, CircularProgress, Typography, useTheme } from '@mui/material'; // ^5.14.0
import { styled } from '@mui/material/styles'; // ^5.14.0

interface PageLoaderProps {
  /**
   * Optional message to display below the loading indicator
   */
  message?: string;
  /**
   * Size variant for the loading indicator
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
}

// Styled container component with accessibility attributes
const LoaderContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  padding: theme.spacing(2),
  transition: 'all 300ms ease-in-out',
  // Ensure container takes full width on all screen sizes
  width: '100%',
  // Prevent any unwanted scrolling
  overflow: 'hidden',
  // Improve text rendering
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
}));

/**
 * A full-page loading component that displays a centered loading indicator
 * with optional message. Compliant with WCAG Level AA 2.1 standards.
 */
const PageLoader = React.memo<PageLoaderProps>(({ 
  message,
  size = 'medium'
}) => {
  const theme = useTheme();

  // Map size prop to pixel values
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56
  };

  const spinnerSize = sizeMap[size];

  return (
    <LoaderContainer
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message || 'Loading content'}
    >
      <CircularProgress
        size={spinnerSize}
        thickness={4}
        color="primary"
        // Ensure proper color contrast for accessibility
        sx={{
          color: theme.palette.primary.main,
          // Improve visibility on different backgrounds
          filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))'
        }}
      />
      
      {message && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            marginTop: theme.spacing(2),
            textAlign: 'center',
            // Ensure text remains readable at all sizes
            maxWidth: '80%',
            // Responsive font size
            fontSize: {
              xs: '0.875rem',
              sm: '1rem'
            },
            // Improve readability
            lineHeight: 1.5,
            letterSpacing: '0.00938em',
            // Prevent text selection during loading
            userSelect: 'none'
          }}
          aria-hidden="true" // Screen readers already announce the status from container
        >
          {message}
        </Typography>
      )}
    </LoaderContainer>
  );
});

// Display name for debugging
PageLoader.displayName = 'PageLoader';

export default PageLoader;