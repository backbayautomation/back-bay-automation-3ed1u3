import React, { useCallback, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMediaQuery, useTheme } from '@mui/material';
import { 
  Home,
  Chat,
  Description,
  Settings
} from '@mui/icons-material';
import { ErrorBoundary } from 'react-error-boundary';

import MainLayout from '../components/common/Layout/MainLayout';
import { useAuth } from '../hooks/useAuth';

// Interface for component props
interface ClientLayoutProps {
  children: React.ReactNode;
  className?: string;
}

// Navigation items configuration with role-based access
const CLIENT_NAVIGATION_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    path: '/client',
    icon: <Home />,
    ariaLabel: 'Navigate to home dashboard',
    roles: ['client_user', 'client_admin']
  },
  {
    id: 'chat',
    label: 'Chat',
    path: '/client/chat',
    icon: <Chat />,
    ariaLabel: 'Open chat interface',
    roles: ['client_user', 'client_admin']
  },
  {
    id: 'documents',
    label: 'Documents',
    path: '/client/documents',
    icon: <Description />,
    ariaLabel: 'View documents',
    roles: ['client_user', 'client_admin']
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/client/settings',
    icon: <Settings />,
    ariaLabel: 'Manage settings',
    roles: ['client_admin']
  }
];

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div role="alert" aria-live="assertive">
    <h2>Something went wrong in the client portal:</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

// Client layout component with memoization
const ClientLayout = React.memo<ClientLayoutProps>(({ children, className }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Filter navigation items based on user roles
  const filteredNavItems = useMemo(() => {
    return CLIENT_NAVIGATION_ITEMS.filter(item => {
      return item.roles.some(role => user.role.includes(role));
    });
  }, [user.role]);

  // Handle navigation analytics
  const handleNavigate = useCallback((path: string) => {
    try {
      window.gtag?.('event', 'client_navigation', {
        path,
        user_id: user.id,
        client_id: user.clientId
      });
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }, [user]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset error state and retry
        window.location.reload();
      }}
    >
      <MainLayout
        portalType="client"
        className={className}
        analyticsEnabled={true}
        items={filteredNavItems}
        onNavigate={handleNavigate}
        sx={{
          // Responsive layout adjustments
          [theme.breakpoints.down('sm')]: {
            padding: theme.spacing(1)
          },
          [theme.breakpoints.up('sm')]: {
            padding: theme.spacing(2)
          },
          [theme.breakpoints.up('md')]: {
            padding: theme.spacing(3)
          },
          // Ensure minimum touch target size for accessibility
          '& .MuiButtonBase-root': {
            minHeight: '44px',
            minWidth: '44px'
          },
          // High contrast mode support
          '@media (forced-colors: active)': {
            borderColor: 'CanvasText'
          },
          // Reduced motion support
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none'
          }
        }}
      >
        {children}
      </MainLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
ClientLayout.displayName = 'ClientLayout';

export default ClientLayout;