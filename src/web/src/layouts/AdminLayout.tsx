import React, { useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { withErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@analytics/react';
import {
  Dashboard,
  People,
  Description,
  Settings,
  Analytics as AnalyticsIcon
} from '@mui/icons-material';
import MainLayout from '../components/common/Layout/MainLayout';
import { useAuth } from '../hooks/useAuth';

// Navigation items for admin portal with role-based access control
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

// Props interface with strict typing
interface AdminLayoutProps {
  children: React.ReactNode;
  className?: string;
}

// Enhanced admin layout with security and analytics
const AdminLayout: React.FC<AdminLayoutProps> = withErrorBoundary(
  ({ children, className }) => {
    const { isAuthenticated, user, hasRole } = useAuth();

    // Track admin portal access
    useEffect(() => {
      Analytics.track('admin_portal_access', {
        userId: user?.id,
        timestamp: new Date().toISOString(),
        success: isAuthenticated && hasRole('admin')
      });

      return () => {
        Analytics.track('admin_portal_exit', {
          userId: user?.id,
          timestamp: new Date().toISOString()
        });
      };
    }, [isAuthenticated, user, hasRole]);

    // Verify authentication and admin role
    if (!isAuthenticated || !hasRole('admin')) {
      Analytics.track('unauthorized_admin_access', {
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      return <Navigate to="/login" replace state={{ from: '/admin' }} />;
    }

    // Filter navigation items based on user roles
    const filteredNavItems = useMemo(() => {
      return ADMIN_NAV_ITEMS.filter(item =>
        item.roles.some(role => hasRole(role))
      );
    }, [hasRole]);

    return (
      <MainLayout
        portalType="admin"
        className={className}
        analyticsEnabled={true}
      >
        <div
          role="main"
          aria-label="Admin Portal Content"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {children}
        </div>
      </MainLayout>
    );
  },
  {
    fallback: (
      <div role="alert" aria-label="Error Boundary">
        An error occurred in the admin portal. Please refresh the page.
      </div>
    ),
    onError: (error) => {
      Analytics.track('admin_portal_error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.error('Admin Portal Error:', error);
    }
  }
);

// Display name for debugging
AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;