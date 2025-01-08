import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Analytics } from '@azure/application-insights';
import { ErrorBoundary } from 'react-error-boundary';
import AdminLayout from '../layouts/AdminLayout';
import ClientLayout from '../layouts/ClientLayout';
import AuthLayout from '../layouts/AuthLayout';

// Constants for route configuration
const ANALYTICS_CATEGORY = 'navigation';
const ROUTE_LOAD_TIMEOUT = 3000;
const CACHE_MAX_AGE = 3600; // 1 hour in seconds

// Interface for enhanced route metadata
interface RouteMeta {
  title: string;
  analyticsId: string;
  cacheStrategy: {
    maxAge: number;
    revalidate?: boolean;
  };
}

// Enhanced route configuration interface
interface RouteConfig extends RouteObject {
  auth: boolean;
  roles: string[];
  meta: RouteMeta;
  errorBoundary?: React.ComponentType;
}

// Lazy-loaded page components with error boundaries
const Dashboard = lazy(() => import('../pages/admin/Dashboard'));
const ClientManagement = lazy(() => import('../pages/admin/ClientManagement'));
const DocumentProcessing = lazy(() => import('../pages/admin/DocumentProcessing'));
const AnalyticsDashboard = lazy(() => import('../pages/admin/Analytics'));
const Settings = lazy(() => import('../pages/admin/Settings'));

const ClientHome = lazy(() => import('../pages/client/Home'));
const Chat = lazy(() => import('../pages/client/Chat'));
const Documents = lazy(() => import('../pages/client/Documents'));
const ClientSettings = lazy(() => import('../pages/client/Settings'));

const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));

// Authentication routes configuration
const AUTH_ROUTES: RouteConfig[] = [
  {
    path: '/login',
    element: <AuthLayout redirectTo="/dashboard">
      <Login />
    </AuthLayout>,
    auth: false,
    roles: [],
    meta: {
      title: 'Login',
      analyticsId: 'auth_login_view',
      cacheStrategy: { maxAge: 0 }
    }
  },
  {
    path: '/register',
    element: <AuthLayout redirectTo="/dashboard">
      <Register />
    </AuthLayout>,
    auth: false,
    roles: [],
    meta: {
      title: 'Register',
      analyticsId: 'auth_register_view',
      cacheStrategy: { maxAge: 0 }
    }
  },
  {
    path: '/forgot-password',
    element: <AuthLayout redirectTo="/login">
      <ForgotPassword />
    </AuthLayout>,
    auth: false,
    roles: [],
    meta: {
      title: 'Forgot Password',
      analyticsId: 'auth_forgot_password_view',
      cacheStrategy: { maxAge: 0 }
    }
  }
];

// Admin portal routes configuration
const ADMIN_ROUTES: RouteConfig[] = [
  {
    path: '/admin',
    element: <AdminLayout>
      <Dashboard />
    </AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Admin Dashboard',
      analyticsId: 'admin_dashboard_view',
      cacheStrategy: { maxAge: CACHE_MAX_AGE }
    }
  },
  {
    path: '/admin/clients',
    element: <AdminLayout>
      <ClientManagement />
    </AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Client Management',
      analyticsId: 'admin_clients_view',
      cacheStrategy: { maxAge: CACHE_MAX_AGE }
    }
  },
  {
    path: '/admin/documents',
    element: <AdminLayout>
      <DocumentProcessing />
    </AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Document Processing',
      analyticsId: 'admin_documents_view',
      cacheStrategy: { maxAge: CACHE_MAX_AGE }
    }
  },
  {
    path: '/admin/analytics',
    element: <AdminLayout>
      <AnalyticsDashboard />
    </AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Analytics',
      analyticsId: 'admin_analytics_view',
      cacheStrategy: { maxAge: CACHE_MAX_AGE, revalidate: true }
    }
  },
  {
    path: '/admin/settings',
    element: <AdminLayout>
      <Settings />
    </AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Admin Settings',
      analyticsId: 'admin_settings_view',
      cacheStrategy: { maxAge: CACHE_MAX_AGE }
    }
  }
];

// Client portal routes configuration
const CLIENT_ROUTES: RouteConfig[] = [
  {
    path: '/client',
    element: <ClientLayout>
      <ClientHome />
    </ClientLayout>,
    auth: true,
    roles: ['CLIENT_ADMIN', 'REGULAR_USER'],
    meta: {
      title: 'Client Home',
      analyticsId: 'client_home_view',
      cacheStrategy: { maxAge: CACHE_MAX_AGE }
    }
  },
  {
    path: '/client/chat',
    element: <ClientLayout>
      <Chat />
    </ClientLayout>,
    auth: true,
    roles: ['CLIENT_ADMIN', 'REGULAR_USER'],
    meta: {
      title: 'Chat',
      analyticsId: 'client_chat_view',
      cacheStrategy: { maxAge: 0 }
    }
  },
  {
    path: '/client/documents',
    element: <ClientLayout>
      <Documents />
    </ClientLayout>,
    auth: true,
    roles: ['CLIENT_ADMIN', 'REGULAR_USER'],
    meta: {
      title: 'Documents',
      analyticsId: 'client_documents_view',
      cacheStrategy: { maxAge: CACHE_MAX_AGE }
    }
  },
  {
    path: '/client/settings',
    element: <ClientLayout>
      <ClientSettings />
    </ClientLayout>,
    auth: true,
    roles: ['CLIENT_ADMIN'],
    meta: {
      title: 'Client Settings',
      analyticsId: 'client_settings_view',
      cacheStrategy: { maxAge: CACHE_MAX_AGE }
    }
  }
];

// Error routes configuration
const ERROR_ROUTES: RouteConfig[] = [
  {
    path: '*',
    element: <ErrorBoundary FallbackComponent={() => <div>Page Not Found</div>}>
      <div>404 - Not Found</div>
    </ErrorBoundary>,
    auth: false,
    roles: [],
    meta: {
      title: 'Not Found',
      analyticsId: 'error_404_view',
      cacheStrategy: { maxAge: 0 }
    }
  }
];

// Function to generate final route configuration with analytics and error handling
const generateRouteConfig = (): RouteObject[] => {
  const allRoutes = [...AUTH_ROUTES, ...ADMIN_ROUTES, ...CLIENT_ROUTES, ...ERROR_ROUTES];

  return allRoutes.map(route => ({
    ...route,
    element: (
      <ErrorBoundary
        FallbackComponent={route.errorBoundary || (() => <div>Error loading page</div>)}
        onError={(error) => {
          Analytics.trackEvent({
            name: 'route_error',
            properties: {
              route: route.path,
              error: error.message,
              category: ANALYTICS_CATEGORY
            }
          });
        }}
      >
        <React.Suspense
          fallback={<div>Loading...</div>}
          options={{
            timeout: ROUTE_LOAD_TIMEOUT
          }}
        >
          {route.element}
        </React.Suspense>
      </ErrorBoundary>
    )
  }));
};

// Export the final route configuration
export default generateRouteConfig();