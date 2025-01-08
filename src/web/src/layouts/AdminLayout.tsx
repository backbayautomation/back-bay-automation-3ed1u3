import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { withErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@analytics/react';
import {
  Dashboard,
  People,
  Description,
  Analytics as AnalyticsIcon,
  Settings
} from '@mui/icons-material';
import MainLayout from '../components/common/Layout/MainLayout';
import { useAuth } from '../hooks/useAuth';

// Constants for admin navigation items with role-based access control
const ADMIN_NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: <Dashboard />,
    roles: ['admin'],
    analytics: 'admin_dashboard_view'
  },
  {
    id: 'clients',
    label: 'Clients',
    path: '/admin/clients',
    icon: <People />,
    roles: ['admin'],
    analytics: 'admin_clients_view'
  },
  {
    id: 'documents',
    label: 'Documents',
    path: '/admin/documents',
    icon: <Description />,
    roles: ['admin'],
    analytics: 'admin_documents_view'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/admin/analytics',
    icon: <AnalyticsIcon />,
    roles: ['admin'],
    analytics: 'admin_analytics_view'
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/admin/settings',
    icon: <Settings />,
    roles: ['admin'],
    analytics: 'admin_settings_view'
  }
];

// Props interface for AdminLayout
interface AdminLayoutProps {
  children: React.ReactNode;
  className?: string;
}

// Error boundary fallback component
const AdminLayoutErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" style={{ padding: '2rem' }}>
    <h2>Admin Portal Error</h2>
    <pre>{error.message}</pre>
  </div>
);

/**
 * AdminLayout component providing secure admin portal structure with
 * role-based access control, analytics tracking, and error handling
 */
const AdminLayout: React.FC<AdminLayoutProps> = ({ children, className }) => {
  const { isAuthenticated, user, hasRole } = useAuth();

  // Track admin portal access
  useEffect(() => {
    Analytics.track('admin_portal_access', {
      userId: user?.id,
      timestamp: new Date().toISOString()
    });

    return () => {
      Analytics.track('admin_portal_exit', {
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
    };
  }, [user?.id]);

  // Redirect to login if not authenticated or not admin
  if (!isAuthenticated || !hasRole('SYSTEM_ADMIN')) {
    Analytics.track('admin_access_denied', {
      userId: user?.id,
      reason: !isAuthenticated ? 'not_authenticated' : 'insufficient_permissions'
    });
    return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  }

  return (
    <MainLayout
      portalType="admin"
      className={className}
      analyticsEnabled={true}
    >
      {children}
    </MainLayout>
  );
};

// Export enhanced AdminLayout with error boundary
export default withErrorBoundary(AdminLayout, {
  FallbackComponent: AdminLayoutErrorFallback,
  onError: (error) => {
    Analytics.track('admin_layout_error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});