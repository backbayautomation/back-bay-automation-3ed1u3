import React, { lazy, Suspense } from 'react';
import { Grid, Paper, Typography, Box, Skeleton, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { ErrorBoundary } from 'react-error-boundary';
import ClientLayout from '../../layouts/ClientLayout';

// Lazy loaded components
const ChatInterface = lazy(() => import('../../components/chat/ChatInterface'));
const DocumentContext = lazy(() => import('../../components/documents/DocumentContext'));

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
  transition: theme.transitions.create(['box-shadow'], {
    duration: theme.transitions.duration.short
  }),
  '&:hover': {
    boxShadow: theme.shadows[3]
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none'
  }
}));

const QuickAccessContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: { xs: 'auto', md: '100%' },
  display: 'flex',
  flexDirection: 'column',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  transition: theme.transitions.create(['box-shadow'], {
    duration: theme.transitions.duration.short
  }),
  '&:hover': {
    boxShadow: theme.shadows[3]
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none'
  }
}));

// Loading skeleton component
const LoadingSkeleton = () => (
  <Box sx={{ width: '100%', p: 2 }}>
    <Skeleton variant="rectangular" width="100%" height={200} sx={{ mb: 2 }} />
    <Skeleton variant="text" width="60%" height={32} sx={{ mb: 1 }} />
    <Skeleton variant="text" width="40%" height={24} />
  </Box>
);

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <Box
    role="alert"
    sx={{
      p: 3,
      color: 'error.main',
      textAlign: 'center'
    }}
  >
    <Typography variant="h6" gutterBottom>
      Something went wrong:
    </Typography>
    <Typography variant="body2" sx={{ mb: 2 }}>
      {error.message}
    </Typography>
    <button onClick={resetErrorBoundary}>Try again</button>
  </Box>
);

// Main component
const Home = React.memo<HomeProps>(({ className }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <ClientLayout>
      <Box
        component="main"
        className={className}
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: '100%',
          maxWidth: theme.breakpoints.values.xl,
          margin: '0 auto'
        }}
      >
        <WelcomeContainer>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ fontWeight: theme.typography.fontWeightBold }}
          >
            Welcome to Product Search
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: '800px' }}
          >
            Ask questions about your technical products and get instant, accurate answers powered by AI.
            Our system analyzes your product documentation to provide precise information.
          </Typography>
        </WelcomeContainer>

        <Grid container spacing={3}>
          <Grid item xs={12} md={7} lg={8}>
            <QuickAccessContainer>
              <Typography
                variant="h6"
                component="h2"
                gutterBottom
                sx={{ px: 1, fontWeight: theme.typography.fontWeightMedium }}
              >
                Chat Interface
              </Typography>
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <Suspense fallback={<LoadingSkeleton />}>
                  <ChatInterface />
                </Suspense>
              </ErrorBoundary>
            </QuickAccessContainer>
          </Grid>

          <Grid item xs={12} md={5} lg={4}>
            <QuickAccessContainer>
              <Typography
                variant="h6"
                component="h2"
                gutterBottom
                sx={{ px: 1, fontWeight: theme.typography.fontWeightMedium }}
              >
                Document Context
              </Typography>
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <Suspense fallback={<LoadingSkeleton />}>
                  <DocumentContext />
                </Suspense>
              </ErrorBoundary>
            </QuickAccessContainer>
          </Grid>
        </Grid>
      </Box>
    </ClientLayout>
  );
});

// Display name for debugging
Home.displayName = 'Home';

export default Home;