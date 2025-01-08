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

// Navigation items with role-based access control
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
const ClientLayoutErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
    <h2>Client Portal Error</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
  </div>
);

/**
 * Client portal layout component implementing the client side of the dual-portal system
 * with Material-UI v5 integration, responsive design, and accessibility features.
 */
const ClientLayout = React.memo<ClientLayoutProps>(({ children, className }) => {
  const { isAuthenticated, user } = useAuth();
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Filter navigation items based on user roles
  const filteredNavItems = useMemo(() => {
    return CLIENT_NAVIGATION_ITEMS.filter(item => 
      item.roles.some(role => user.role.toLowerCase().includes(role))
    );
  }, [user.role]);

  // Handle navigation errors
  const handleError = useCallback((error: Error) => {
    console.error('Client Layout Error:', error);
    // TODO: Add error reporting service integration
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ClientLayoutErrorFallback}
      onError={handleError}
    >
      <MainLayout
        portalType="client"
        className={className}
        analyticsEnabled={true}
        navigationItems={filteredNavItems}
        sx={{
          // Responsive styles based on breakpoints
          [theme.breakpoints.down('sm')]: {
            padding: theme.spacing(2),
          },
          [theme.breakpoints.up('sm')]: {
            padding: theme.spacing(3),
          },
          // Ensure sufficient touch targets for mobile
          '& .MuiButtonBase-root': {
            minHeight: isMobile ? '44px' : '36px',
          },
          // High contrast mode support
          '@media (forced-colors: active)': {
            borderColor: 'CanvasText',
          },
          // Reduced motion support
          '@media (prefers-reduced-motion: reduce)': {
            '& *': {
              animationDuration: '0.001ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.001ms !important',
            },
          },
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