import React from 'react'; // v18.2.0
import { Box, Typography, Container, useTheme } from '@mui/material'; // v5.14.0
import { ErrorOutline } from '@mui/icons-material'; // v5.14.0
import { useNavigate } from 'react-router-dom'; // v6.0.0
import MainLayout from '../../components/common/Layout/MainLayout';
import PrimaryButton from '../../components/common/Buttons/PrimaryButton';

// Constants for error page configuration
const ERROR_ICON_SIZE = 64;
const ERROR_MESSAGE = 'Internal Server Error';
const ERROR_DESCRIPTION = 'We apologize for the inconvenience. Please try again later or contact support if the problem persists.';

// Styled components using Material-UI system
const ErrorContainer = React.memo(({ children }: { children: React.ReactNode }) => {
  const theme = useTheme();
  
  return (
    <Container
      sx={{
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
      }}
    >
      {children}
    </Container>
  );
});

const ActionContainer = React.memo(({ children }: { children: React.ReactNode }) => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        display: 'flex',
        gap: theme.spacing(2),
        marginTop: theme.spacing(4),
        '@media (max-width: 600px)': {
          flexDirection: 'column',
        },
      }}
    >
      {children}
    </Box>
  );
});

/**
 * Server error page component implementing WCAG 2.1 AA compliance with
 * responsive design and keyboard navigation support.
 */
const Error500 = React.memo(() => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Handlers for error recovery actions
  const handleRetry = React.useCallback(() => {
    window.location.reload();
  }, []);

  const handleGoHome = React.useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <MainLayout portalType="client">
      <ErrorContainer>
        {/* Error Icon with proper color contrast */}
        <ErrorOutline
          sx={{
            fontSize: ERROR_ICON_SIZE,
            color: theme.palette.error.main,
            mb: theme.spacing(2),
          }}
          role="img"
          aria-label="Error indicator"
        />

        {/* Error heading with semantic markup */}
        <Typography
          variant="h4"
          component="h1"
          color="text.primary"
          gutterBottom
          sx={{ fontWeight: 500 }}
        >
          {ERROR_MESSAGE}
        </Typography>

        {/* Error description with proper contrast */}
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            maxWidth: '600px',
            mb: theme.spacing(4),
          }}
        >
          {ERROR_DESCRIPTION}
        </Typography>

        {/* Action buttons with keyboard focus support */}
        <ActionContainer>
          <PrimaryButton
            onClick={handleRetry}
            size="large"
            aria-label="Retry current page"
          >
            Try Again
          </PrimaryButton>

          <PrimaryButton
            onClick={handleGoHome}
            variant="secondary"
            size="large"
            aria-label="Return to home page"
          >
            Go to Home
          </PrimaryButton>
        </ActionContainer>
      </ErrorContainer>
    </MainLayout>
  );
});

// Display name for debugging
Error500.displayName = 'Error500';

// Error boundary wrapped export
export default Error500;