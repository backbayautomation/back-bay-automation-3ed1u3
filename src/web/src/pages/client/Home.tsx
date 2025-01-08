import React, { Suspense, useCallback } from 'react';
import { Grid, Paper, Typography, Box, Skeleton, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { ErrorBoundary } from 'react-error-boundary';
import ClientLayout from '../../layouts/ClientLayout';

// Lazy load components for better performance
const ChatInterface = React.lazy(() => import('../../components/chat/ChatInterface'));
const DocumentContext = React.lazy(() => import('../../components/document/DocumentContext'));

// Props interface
interface HomeProps {
  className?: string;
}

// Styled components with theme integration
const WelcomeContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  transition: theme.transitions.create('box-shadow', {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    boxShadow: theme.shadows[3],
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const QuickAccessContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  transition: theme.transitions.create('box-shadow', {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    boxShadow: theme.shadows[3],
  },
  [theme.breakpoints.down('sm')]: {
    marginBottom: theme.spacing(2),
  },
}));

// Loading skeleton component
const LoadingSkeleton: React.FC = () => (
  <Box sx={{ width: '100%' }}>
    <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Skeleton variant="rectangular" height={400} />
      </Grid>
      <Grid item xs={12} md={6}>
        <Skeleton variant="rectangular" height={400} />
      </Grid>
    </Grid>
  </Box>
);

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Box
    role="alert"
    sx={{
      p: 3,
      color: 'error.main',
      textAlign: 'center',
    }}
  >
    <Typography variant="h6" gutterBottom>
      Something went wrong:
    </Typography>
    <Typography variant="body2">{error.message}</Typography>
  </Box>
);

// Main component
const Home = React.memo<HomeProps>(({ className }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Error handler for error boundary
  const handleError = useCallback((error: Error) => {
    console.error('Home Component Error:', error);
    // TODO: Add error reporting service integration
  }, []);

  return (
    <ClientLayout>
      <ErrorBoundary FallbackComponent={ErrorFallback} onError={handleError}>
        <Box
          component="main"
          className={className}
          sx={{
            flexGrow: 1,
            width: '100%',
            animation: 'fadeIn 0.5s ease-in-out',
            '@keyframes fadeIn': {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
          }}
        >
          <WelcomeContainer>
            <Typography
              variant="h1"
              gutterBottom
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                fontWeight: theme.typography.fontWeightBold,
              }}
            >
              Welcome to Product Search
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: '800px' }}
            >
              Access technical product information instantly through our AI-powered search system.
              Start a conversation or browse through relevant documents to find what you need.
            </Typography>
          </WelcomeContainer>

          <Grid
            container
            spacing={3}
            sx={{
              [theme.breakpoints.down('sm')]: {
                spacing: 2,
              },
            }}
          >
            <Grid item xs={12} md={6}>
              <QuickAccessContainer>
                <Typography
                  variant="h2"
                  gutterBottom
                  sx={{
                    fontSize: { xs: '1.25rem', sm: '1.5rem' },
                    fontWeight: theme.typography.fontWeightMedium,
                  }}
                >
                  Chat Interface
                </Typography>
                <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
                  <ChatInterface />
                </Suspense>
              </QuickAccessContainer>
            </Grid>

            <Grid item xs={12} md={6}>
              <QuickAccessContainer>
                <Typography
                  variant="h2"
                  gutterBottom
                  sx={{
                    fontSize: { xs: '1.25rem', sm: '1.5rem' },
                    fontWeight: theme.typography.fontWeightMedium,
                  }}
                >
                  Document Context
                </Typography>
                <Suspense fallback={<Skeleton variant="rectangular" height={400} />}>
                  <DocumentContext />
                </Suspense>
              </QuickAccessContainer>
            </Grid>
          </Grid>
        </Box>
      </ErrorBoundary>
    </ClientLayout>
  );
});

// Display name for debugging
Home.displayName = 'Home';

export default Home;