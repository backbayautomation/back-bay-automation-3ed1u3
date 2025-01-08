import React from 'react'; // ^18.2.0
import { Box, CircularProgress, Typography, useTheme } from '@mui/material'; // 5.14.0
import { styled } from '@mui/material/styles'; // 5.14.0

// Props interface for the PageLoader component
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
  // Ensure container takes full width on mobile
  width: '100%',
  // Add responsive padding based on breakpoints
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(4),
  },
}));

/**
 * A full-page loading component that displays a centered loading indicator
 * with an optional message. Compliant with WCAG Level AA 2.1 standards.
 */
const PageLoader: React.FC<PageLoaderProps> = React.memo(({ 
  message,
  size = 'medium'
}) => {
  const theme = useTheme();

  // Map size prop to pixel values
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56,
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
          '& .MuiCircularProgress-circle': {
            strokeLinecap: 'round',
          },
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
            fontSize: {
              xs: '0.875rem',
              sm: '1rem',
            },
            // Maintain proper line height for readability
            lineHeight: 1.5,
            // Ensure proper color contrast
            color: theme.palette.text.secondary,
            // Add max width to prevent extremely long messages from breaking layout
            maxWidth: '80%',
            wordBreak: 'break-word',
          }}
          aria-hidden="true" // Screen readers already announce the status from container
        >
          {message}
        </Typography>
      )}
    </LoaderContainer>
  );
});

// Display name for debugging purposes
PageLoader.displayName = 'PageLoader';

export default PageLoader;