import React, { useCallback, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMediaQuery, useTheme } from '@mui/material';
import { 
  Home as HomeIcon,
  Chat as ChatIcon,
  Description as DocumentIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { ErrorBoundary } from 'react-error-boundary';
import MainLayout from '../components/common/Layout/MainLayout';
import { useAuth } from '../hooks/useAuth';

// Interface for component props
interface ClientLayoutProps {
  children: React.ReactNode;
  className?: string;
}

// Navigation items configuration with role-based access control
const CLIENT_NAVIGATION_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    path: '/client',
    icon: <HomeIcon />,
    ariaLabel: 'Navigate to home dashboard',
    roles: ['client_user', 'client_admin']
  },
  {
    id: 'chat',
    label: 'Chat',
    path: '/client/chat',
    icon: <ChatIcon />,
    ariaLabel: 'Open chat interface',
    roles: ['client_user', 'client_admin']
  },
  {
    id: 'documents',
    label: 'Documents',
    path: '/client/documents',
    icon: <DocumentIcon />,
    ariaLabel: 'View documents',
    roles: ['client_user', 'client_admin']
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/client/settings',
    icon: <SettingsIcon />,
    ariaLabel: 'Manage settings',
    roles: ['client_admin']
  }
];

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  const theme = useTheme();
  
  return (
    <div
      role="alert"
      style={{
        padding: theme.spacing(3),
        color: theme.palette.error.main,
        textAlign: 'center'
      }}
    >
      <h2>Client Portal Error</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
    </div>
  );
};

// Main ClientLayout component
const ClientLayout: React.FC<ClientLayoutProps> = React.memo(({ children, className }) => {
  const { isAuthenticated, user } = useAuth();
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Filter navigation items based on user roles
  const filteredNavItems = useMemo(() => {
    return CLIENT_NAVIGATION_ITEMS.filter(item => {
      return item.roles.some(role => user.role.toLowerCase().includes(role));
    });
  }, [user.role]);

  // Analytics tracking callback
  const handleAnalytics = useCallback((path: string) => {
    try {
      // Track navigation events
      const analyticsData = {
        event: 'client_navigation',
        path,
        userId: user.id,
        clientId: user.clientId,
        timestamp: new Date().toISOString()
      };
      
      // Send analytics data
      fetch('/api/analytics/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analyticsData)
      });
    } catch (error) {
      console.error('Analytics Error:', error);
    }
  }, [user.id, user.clientId]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('Client Layout Error:', error);
        // Additional error logging or reporting could be added here
      }}
    >
      <MainLayout
        portalType="client"
        className={className}
        analyticsEnabled={true}
        items={filteredNavItems}
        onNavigate={handleAnalytics}
        sx={{
          // Responsive layout adjustments
          padding: {
            xs: theme.spacing(2),
            sm: theme.spacing(3),
            md: theme.spacing(4)
          },
          // Ensure minimum touch target sizes for mobile
          '& .MuiButtonBase-root': {
            minHeight: isMobile ? 44 : 36,
            minWidth: isMobile ? 44 : 36
          },
          // Improve focus visibility for accessibility
          '& :focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px'
          },
          // High contrast mode support
          '@media (forced-colors: active)': {
            borderColor: 'CanvasText'
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