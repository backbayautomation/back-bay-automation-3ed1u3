import React, { useEffect } from 'react';
import { Box, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAnalytics } from '@azure/analytics';
import { ErrorBoundary } from 'react-error-boundary';
import MainLayout from '../../components/common/Layout/MainLayout';
import PrimaryButton from '../../components/common/Buttons/PrimaryButton';

// Constants for analytics and accessibility
const ERROR_PAGE_TITLE = '404 - Page Not Found';
const ERROR_PAGE_DESCRIPTION = 'The page you are looking for does not exist or has been moved.';
const ANALYTICS_EVENT = 'error_page_view';
const ARIA_LABELS = {
  ERROR_SECTION: 'Error page content',
  HOME_BUTTON: 'Return to home page',
  BACK_BUTTON: 'Go back to previous page'
};

/**
 * Error page container with responsive styling and accessibility features
 */
const ErrorContainer = React.memo(({ children }: { children: React.ReactNode }) => (
  <Container
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 112px)', // Viewport - Header - Footer
      textAlign: 'center',
      padding: { xs: 2, sm: 3 },
      gap: 2,
      maxWidth: 600
    }}
  >
    {children}
  </Container>
));

ErrorContainer.displayName = 'ErrorContainer';

/**
 * 404 Error page component with analytics tracking and accessibility features
 */
const Error404: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const analytics = useAnalytics();

  // Track error page view
  useEffect(() => {
    analytics.trackEvent({
      name: ANALYTICS_EVENT,
      properties: {
        path: window.location.pathname,
        timestamp: new Date().toISOString()
      }
    });
  }, [analytics]);

  // Navigation handlers with analytics
  const handleGoBack = React.useCallback(() => {
    analytics.trackEvent({
      name: 'error_page_action',
      properties: {
        action: 'go_back',
        path: window.location.pathname
      }
    });
    navigate(-1);
  }, [navigate, analytics]);

  const handleGoHome = React.useCallback(() => {
    analytics.trackEvent({
      name: 'error_page_action',
      properties: {
        action: 'go_home',
        path: window.location.pathname
      }
    });
    navigate('/');
  }, [navigate, analytics]);

  // Error boundary fallback
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Box sx={{ color: 'error.main', textAlign: 'center', p: 2 }}>
      <Typography variant="h6">Something went wrong</Typography>
      <Typography variant="body2">{error.message}</Typography>
    </Box>
  );

  return (
    <MainLayout portalType="client">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <ErrorContainer>
          <Box
            role="region"
            aria-label={ARIA_LABELS.ERROR_SECTION}
            sx={{ mb: 4 }}
          >
            <Typography
              variant="h1"
              component="h1"
              sx={{
                color: 'error.main',
                fontSize: { xs: '2rem', sm: '3rem' },
                mb: 2,
                fontWeight: 700
              }}
            >
              {ERROR_PAGE_TITLE}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                mb: 4,
                fontSize: { xs: '1rem', sm: '1.125rem' }
              }}
            >
              {ERROR_PAGE_DESCRIPTION}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              width: '100%',
              maxWidth: 400,
              mx: 'auto'
            }}
          >
            <PrimaryButton
              onClick={handleGoBack}
              fullWidth
              aria-label={ARIA_LABELS.BACK_BUTTON}
              size="large"
              variant="secondary"
            >
              Go Back
            </PrimaryButton>
            <PrimaryButton
              onClick={handleGoHome}
              fullWidth
              aria-label={ARIA_LABELS.HOME_BUTTON}
              size="large"
              variant="primary"
            >
              Go to Home
            </PrimaryButton>
          </Box>
        </ErrorContainer>
      </ErrorBoundary>
    </MainLayout>
  );
});

Error404.displayName = 'Error404';

export default Error404;