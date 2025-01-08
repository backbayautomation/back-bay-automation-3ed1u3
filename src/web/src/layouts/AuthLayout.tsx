import React from 'react'; // ^18.2.0
import { Box, Container, Paper } from '@mui/material'; // ^5.14.0
import { styled } from '@mui/material/styles'; // ^5.14.0
import { Navigate } from 'react-router-dom'; // ^6.14.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { useAuth } from '../contexts/AuthContext';
import PageLoader from '../components/common/Loaders/PageLoader';

/**
 * Props interface for AuthLayout component
 */
interface AuthLayoutProps {
  children: React.ReactNode;
  redirectTo: string;
  fallback?: React.ReactNode;
}

/**
 * Styled container for authentication pages with enhanced accessibility
 */
const AuthContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.background.default,
  padding: theme.spacing(3),
  // Responsive padding adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
  // Accessibility attributes
  role: 'main',
  'aria-label': 'Authentication page',
  // Prevent content shift during loading
  position: 'relative',
  // Improve text rendering
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
}));

/**
 * Styled paper component for auth content with improved visuals
 */
const AuthPaper = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: 400,
  padding: theme.spacing(4),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  backgroundColor: theme.palette.background.paper,
  position: 'relative',
  // Responsive adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
    maxWidth: '100%',
  },
  // Smooth transitions
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  '&:hover': {
    boxShadow: theme.shadows[4],
  },
  // Improve focus visibility
  '&:focus-within': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <AuthContainer>
    <AuthPaper>
      <Box
        sx={{
          textAlign: 'center',
          color: 'error.main',
          p: 2,
        }}
      >
        <h2>Authentication Error</h2>
        <p>{error.message}</p>
      </Box>
    </AuthPaper>
  </AuthContainer>
);

/**
 * Layout component for authentication pages with enhanced error handling
 * and state management
 */
const AuthLayout = React.memo<AuthLayoutProps>(({
  children,
  redirectTo,
  fallback = <DefaultErrorFallback />
}) => {
  const { state: { isAuthenticated, isLoading, error } } = useAuth();

  // Show loader during authentication check
  if (isLoading) {
    return (
      <PageLoader
        message="Verifying authentication..."
        size="medium"
      />
    );
  }

  // Redirect authenticated users
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        React.isValidElement(fallback) 
          ? fallback 
          : <DefaultErrorFallback error={error} />
      )}
    >
      <AuthContainer>
        <AuthPaper
          component="main"
          elevation={3}
          role="region"
          aria-label="Authentication form"
        >
          {error ? (
            <Box
              sx={{
                color: 'error.main',
                mb: 2,
                textAlign: 'center',
              }}
              role="alert"
            >
              {error}
            </Box>
          ) : null}
          {children}
        </AuthPaper>
      </AuthContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;