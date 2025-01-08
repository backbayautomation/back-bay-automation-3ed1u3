import React, { useEffect } from 'react';
import { Box, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAnalytics } from '@azure/analytics';
import { ErrorBoundary } from 'react-error-boundary';
import MainLayout from '../../components/common/Layout/MainLayout';
import PrimaryButton from '../../components/common/Buttons/PrimaryButton';

// Constants for analytics and accessibility
const ERROR_PAGE_VIEW = 'error_404_view';
const ERROR_PAGE_EXIT = 'error_404_exit';
const ARIA_LABELS = {
  MAIN: 'Error 404 - Page Not Found',
  DESCRIPTION: 'The requested page could not be found',
  GO_BACK: 'Go back to previous page',
  GO_HOME: 'Go to home page',
};

// Styled container for error content with responsive layout
const ErrorContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: `calc(100vh - ${theme.spacing(8)} - ${theme.spacing(6)})`,
  textAlign: 'center',
  padding: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
  gap: theme.spacing(2),
  maxWidth: 600,
}));

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Box role="alert" p={3} textAlign="center">
    <Typography variant="h6" color="error" gutterBottom>
      Something went wrong
    </Typography>
    <Typography variant="body2" color="textSecondary">
      {error.message}
    </Typography>
  </Box>
);

/**
 * 404 Error page component with accessibility features and analytics tracking
 * Implements WCAG Level AA 2.1 compliance and responsive design
 */
const Error404: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const analytics = useAnalytics();

  // Track error page view
  useEffect(() => {
    analytics.trackEvent(ERROR_PAGE_VIEW, {
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
    });

    return () => {
      analytics.trackEvent(ERROR_PAGE_EXIT, {
        duration: Date.now() - performance.now(),
      });
    };
  }, [analytics]);

  // Navigation handlers with error boundary
  const handleGoBack = React.useCallback(() => {
    try {
      navigate(-1);
      analytics.trackEvent('error_404_go_back');
    } catch (error) {
      console.error('Navigation error:', error);
      navigate('/');
    }
  }, [navigate, analytics]);

  const handleGoHome = React.useCallback(() => {
    try {
      navigate('/');
      analytics.trackEvent('error_404_go_home');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigate, analytics]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <MainLayout portalType="client">
        <ErrorContainer>
          {/* Accessible heading hierarchy */}
          <Typography
            variant="h1"
            component="h1"
            color="error"
            gutterBottom
            aria-label={ARIA_LABELS.MAIN}
            sx={{
              fontSize: { xs: '2rem', sm: '3rem' },
              fontWeight: 'bold',
            }}
          >
            404
          </Typography>

          <Typography
            variant="h2"
            component="h2"
            color="textPrimary"
            gutterBottom
            aria-label={ARIA_LABELS.DESCRIPTION}
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem' },
              mb: 3,
            }}
          >
            Page Not Found
          </Typography>

          <Typography
            variant="body1"
            color="textSecondary"
            paragraph
            sx={{ mb: 4 }}
          >
            The page you are looking for might have been removed, had its name
            changed, or is temporarily unavailable.
          </Typography>

          {/* Navigation buttons with keyboard accessibility */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              width: '100%',
              maxWidth: 400,
              mx: 'auto',
            }}
          >
            <PrimaryButton
              onClick={handleGoBack}
              fullWidth
              variant="secondary"
              aria-label={ARIA_LABELS.GO_BACK}
              data-testid="go-back-button"
            >
              Go Back
            </PrimaryButton>

            <PrimaryButton
              onClick={handleGoHome}
              fullWidth
              variant="primary"
              aria-label={ARIA_LABELS.GO_HOME}
              data-testid="go-home-button"
            >
              Go to Home
            </PrimaryButton>
          </Box>
        </ErrorContainer>
      </MainLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
Error404.displayName = 'Error404';

export default Error404;