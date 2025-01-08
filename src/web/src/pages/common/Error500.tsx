import React from 'react';
import { Box, Typography, Container, useTheme } from '@mui/material'; // v5.14.0
import { ErrorOutline } from '@mui/icons-material'; // v5.14.0
import { useNavigate } from 'react-router-dom'; // v6.0.0
import MainLayout from '../../components/common/Layout/MainLayout';
import PrimaryButton from '../../components/common/Buttons/PrimaryButton';
import { styled } from '@mui/material/styles';

// Constants for component configuration
const ERROR_ICON_SIZE = 64;
const ERROR_MESSAGE = 'Internal Server Error';
const ERROR_DESCRIPTION = 'We apologize for the inconvenience. Please try again later or contact support if the problem persists.';

// Styled components with theme integration
const ErrorContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: `calc(100vh - ${theme.spacing(8)})`,
  textAlign: 'center',
  padding: theme.spacing(4),
  gap: theme.spacing(3),
  '@media (max-width: 600px)': {
    padding: theme.spacing(2),
  },
}));

const ActionContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  marginTop: theme.spacing(4),
  '@media (max-width: 600px)': {
    flexDirection: 'column',
  },
}));

/**
 * Server error page component with retry and home navigation options,
 * implementing full accessibility support and responsive design.
 */
const Error500: React.FC = React.memo(() => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Handler for retry action
  const handleRetry = React.useCallback(() => {
    window.location.reload();
  }, []);

  // Handler for home navigation
  const handleGoHome = React.useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <MainLayout portalType="client">
      <ErrorContainer maxWidth="sm">
        <ErrorOutline
          sx={{
            fontSize: ERROR_ICON_SIZE,
            color: theme.palette.error.main,
            mb: 2,
          }}
          role="img"
          aria-label="Error icon"
        />

        <Typography
          variant="h4"
          component="h1"
          color="text.primary"
          gutterBottom
          sx={{
            fontWeight: 500,
            '@media (max-width: 600px)': {
              fontSize: '1.5rem',
            },
          }}
        >
          {ERROR_MESSAGE}
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            maxWidth: '600px',
            lineHeight: 1.6,
            '@media (max-width: 600px)': {
              fontSize: '0.875rem',
            },
          }}
        >
          {ERROR_DESCRIPTION}
        </Typography>

        <ActionContainer>
          <PrimaryButton
            onClick={handleRetry}
            size="large"
            aria-label="Retry current page"
            data-testid="retry-button"
          >
            Try Again
          </PrimaryButton>

          <PrimaryButton
            onClick={handleGoHome}
            variant="secondary"
            size="large"
            aria-label="Return to home page"
            data-testid="home-button"
          >
            Return Home
          </PrimaryButton>
        </ActionContainer>
      </ErrorContainer>
    </MainLayout>
  );
});

// Display name for debugging
Error500.displayName = 'Error500';

export default Error500;