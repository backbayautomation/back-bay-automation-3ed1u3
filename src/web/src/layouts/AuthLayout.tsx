import React from 'react'; // ^18.2.0
import { Box, Container, Paper } from '@mui/material'; // 5.14.0
import { styled } from '@mui/material/styles'; // 5.14.0
import { Navigate } from 'react-router-dom'; // ^6.14.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { useAuth } from '../contexts/AuthContext';
import PageLoader from '../components/common/Loaders/PageLoader';

/**
 * Props interface for AuthLayout component with proper typing
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
    margin: theme.spacing(2),
  },
  // Animation for smooth mounting
  animation: 'fadeIn 0.3s ease-in-out',
  '@keyframes fadeIn': {
    from: { opacity: 0, transform: 'translateY(-20px)' },
    to: { opacity: 1, transform: 'translateY(0)' }
  }
}));

/**
 * Default error fallback component for auth-related errors
 */
const DefaultErrorFallback = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  color: theme.palette.error.main,
}));

/**
 * Layout component for authentication pages with enhanced error handling
 * and state management
 */
const AuthLayout: React.FC<AuthLayoutProps> = React.memo(({
  children,
  redirectTo,
  fallback
}) => {
  const { state: { isAuthenticated, isLoading, error } } = useAuth();

  // Show loader while checking authentication state
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
      fallback={fallback || <DefaultErrorFallback>
        {error || 'An error occurred during authentication'}
      </DefaultErrorFallback>}
    >
      <AuthContainer maxWidth="sm">
        <AuthPaper
          elevation={3}
          component="main"
          role="region"
          aria-label="Authentication form"
        >
          {children}
        </AuthPaper>
      </AuthContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;