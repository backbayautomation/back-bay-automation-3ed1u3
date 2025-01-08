import React, { Suspense, useCallback } from 'react';
import { Grid, Paper, Typography, Box, Skeleton, useMediaQuery } from '@mui/material'; // v5.14.0
import { styled, useTheme } from '@mui/material/styles'; // v5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import ClientLayout from '../../layouts/ClientLayout';

// Lazy load components for better performance
const ChatInterface = React.lazy(() => import('../../components/chat/ChatInterface'));
const DocumentContext = React.lazy(() => import('../../components/documents/DocumentContext'));

// Props interface
interface HomeProps {
  className?: string;
}

// Styled components
const WelcomeContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  transition: theme.transitions.create(['box-shadow']),
  '&:hover': {
    boxShadow: theme.shadows[3]
  }
}));

const QuickAccessContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: { xs: 'auto', md: '100%' },
  display: 'flex',
  flexDirection: 'column',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  transition: theme.transitions.create(['box-shadow']),
  '&:hover': {
    boxShadow: theme.shadows[3]
  }
}));

// Loading skeleton component
const LoadingSkeleton: React.FC = () => (
  <Box sx={{ width: '100%', p: 2 }}>
    <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
    <Skeleton variant="text" width="60%" height={32} sx={{ mb: 1 }} />
    <Skeleton variant="text" width="40%" height={24} />
  </Box>
);

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Box
    role="alert"
    sx={{
      p: 3,
      color: 'error.main',
      textAlign: 'center'
    }}
  >
    <Typography variant="h6" component="h2" gutterBottom>
      Something went wrong
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {error.message}
    </Typography>
  </Box>
);

// Main component
const Home: React.FC<HomeProps> = React.memo(({ className }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Error logging callback
  const handleError = useCallback((error: Error) => {
    console.error('Home Component Error:', error);
    // Additional error logging/monitoring could be added here
  }, []);

  return (
    <ClientLayout>
      <Box
        component="main"
        className={className}
        sx={{
          flexGrow: 1,
          width: '100%',
          minHeight: '100vh',
          p: { xs: 2, sm: 3 }
        }}
      >
        <WelcomeContainer>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 500,
              color: 'text.primary',
              mb: 2
            }}
          >
            Welcome to Product Search
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 800 }}
          >
            Access technical product information instantly through our AI-powered search system.
            Start by asking a question or browsing through the document context.
          </Typography>
        </WelcomeContainer>

        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onError={handleError}
            >
              <QuickAccessContainer>
                <Typography
                  variant="h6"
                  component="h2"
                  gutterBottom
                  sx={{ mb: 2 }}
                >
                  Chat Interface
                </Typography>
                <Suspense fallback={<LoadingSkeleton />}>
                  <ChatInterface />
                </Suspense>
              </QuickAccessContainer>
            </ErrorBoundary>
          </Grid>

          <Grid item xs={12} md={5}>
            <ErrorBoundary
              FallbackComponent={ErrorFallback}
              onError={handleError}
            >
              <QuickAccessContainer>
                <Typography
                  variant="h6"
                  component="h2"
                  gutterBottom
                  sx={{ mb: 2 }}
                >
                  Document Context
                </Typography>
                <Suspense fallback={<LoadingSkeleton />}>
                  <DocumentContext />
                </Suspense>
              </QuickAccessContainer>
            </ErrorBoundary>
          </Grid>
        </Grid>
      </Box>
    </ClientLayout>
  );
});

// Display name for debugging
Home.displayName = 'Home';

export default Home;