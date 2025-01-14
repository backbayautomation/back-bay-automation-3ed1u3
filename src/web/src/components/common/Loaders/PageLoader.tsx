import React from 'react'; // ^18.2.0
import { Box, CircularProgress, Typography, useTheme } from '@mui/material'; // 5.14.0
import { styled } from '@mui/material/styles'; // 5.14.0

interface PageLoaderProps {
  /**
   * Optional loading message to display below the spinner
   */
  message?: string;
  /**
   * Optional size variant for the loading indicator
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
  // Add responsive padding based on screen size
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
  [theme.breakpoints.up('lg')]: {
    padding: theme.spacing(3),
  },
}));

/**
 * A full-page loading component that displays a centered loading indicator
 * with optional message while maintaining accessibility standards.
 * 
 * @param {PageLoaderProps} props - Component props
 * @returns {JSX.Element} Rendered loading component
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
            // Responsive font size
            fontSize: {
              xs: '0.875rem',
              sm: '1rem',
              md: '1.125rem',
            },
            // Ensure proper line height for readability
            lineHeight: 1.5,
            // Prevent text from being too wide
            maxWidth: '80%',
            // Proper text wrapping
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