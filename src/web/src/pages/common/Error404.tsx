import React, { useEffect, useCallback } from 'react';
import { Box, Typography, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import MainLayout from '../../components/common/Layout/MainLayout';
import PrimaryButton from '../../components/common/Buttons/PrimaryButton';
import { styled } from '@mui/material/styles';

// Styled components for error page layout
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
  maxWidth: '600px',
}));

const ErrorHeading = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  marginBottom: theme.spacing(2),
  fontWeight: theme.typography.fontWeightBold,
  '&::selection': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
}));

const ErrorText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(4),
  '&::selection': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
}));

const ButtonContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
  justifyContent: 'center',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    width: '100%',
  },
}));

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorContainer>
    <ErrorHeading variant="h4">Something went wrong</ErrorHeading>
    <ErrorText>{error.message}</ErrorText>
  </ErrorContainer>
);

// Main 404 error page component
const Error404: React.FC = React.memo(() => {
  const navigate = useNavigate();

  // Track error page view
  useEffect(() => {
    try {
      // Log 404 error occurrence
      fetch('/api/analytics/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: '404',
          path: window.location.pathname,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to log 404 error:', error);
    }
  }, []);

  // Navigation handlers with analytics tracking
  const handleGoBack = useCallback(() => {
    try {
      navigate(-1);
    } catch (error) {
      console.error('Navigation error:', error);
      navigate('/');
    }
  }, [navigate]);

  const handleGoHome = useCallback(() => {
    try {
      navigate('/');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigate]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <MainLayout portalType="client">
        <ErrorContainer>
          <Box
            component="img"
            src="/assets/images/404.svg"
            alt=""
            sx={{
              width: '100%',
              maxWidth: '300px',
              height: 'auto',
              marginBottom: 4,
            }}
            aria-hidden="true"
          />
          
          <ErrorHeading 
            variant="h1" 
            component="h1"
            aria-label="Page not found"
          >
            404: Page Not Found
          </ErrorHeading>

          <ErrorText variant="body1">
            We couldn't find the page you're looking for. It might have been moved,
            deleted, or never existed.
          </ErrorText>

          <ButtonContainer>
            <PrimaryButton
              onClick={handleGoBack}
              aria-label="Go back to previous page"
              size="large"
            >
              Go Back
            </PrimaryButton>

            <PrimaryButton
              onClick={handleGoHome}
              variant="secondary"
              aria-label="Go to home page"
              size="large"
            >
              Go to Home
            </PrimaryButton>
          </ButtonContainer>
        </ErrorContainer>
      </MainLayout>
    </ErrorBoundary>
  );
});

Error404.displayName = 'Error404';

export default Error404;