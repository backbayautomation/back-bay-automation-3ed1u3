import React, { useEffect, useMemo, useCallback } from 'react';
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

// Admin navigation items with role-based access control
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

/**
 * Enhanced AdminLayout component with security, analytics, and error handling
 */
const AdminLayout: React.FC<AdminLayoutProps> = ({ children, className }) => {
  // Authentication and authorization hooks
  const { isAuthenticated, user, hasRole } = useAuth();

  // Analytics instance for tracking admin portal usage
  const analytics = useMemo(() => new Analytics({
    app: 'admin-portal',
    version: '1.0.0',
    debug: process.env.NODE_ENV === 'development'
  }), []);

  // Track admin portal access attempts
  useEffect(() => {
    analytics.track('admin_portal_access', {
      authenticated: isAuthenticated,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });

    return () => {
      analytics.flush();
    };
  }, [analytics, isAuthenticated, user]);

  // Handle navigation with analytics tracking
  const handleNavigation = useCallback((path: string) => {
    const navItem = ADMIN_NAV_ITEMS.find(item => item.path === path);
    if (navItem?.analytics) {
      analytics.track(navItem.analytics, {
        userId: user?.id,
        path,
        timestamp: new Date().toISOString()
      });
    }
  }, [analytics, user]);

  // Verify admin access
  if (!isAuthenticated || !hasRole('admin')) {
    analytics.track('admin_access_denied', {
      userId: user?.id,
      reason: !isAuthenticated ? 'not_authenticated' : 'insufficient_permissions',
      timestamp: new Date().toISOString()
    });

    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
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
      <nav aria-label="Admin navigation">
        {filteredNavItems.map(item => (
          <div key={item.id} role="menuitem">
            {item.icon}
            {item.label}
          </div>
        ))}
      </nav>
      {children}
    </MainLayout>
  );
};

// Error boundary wrapper for admin layout
const AdminLayoutWithErrorBoundary = withErrorBoundary(AdminLayout, {
  fallback: (
    <div role="alert" className="error-boundary">
      <h2>Admin Portal Error</h2>
      <p>An error occurred while loading the admin portal. Please try refreshing the page.</p>
    </div>
  ),
  onError: (error) => {
    console.error('Admin Layout Error:', error);
    // Track error in analytics
    const analytics = new Analytics({
      app: 'admin-portal',
      version: '1.0.0'
    });
    analytics.track('admin_portal_error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Set display name for debugging
AdminLayoutWithErrorBoundary.displayName = 'AdminLayout';

export default AdminLayoutWithErrorBoundary;