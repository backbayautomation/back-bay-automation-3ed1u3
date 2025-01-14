import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Analytics } from '@azure/application-insights';
import { ErrorBoundary } from 'react-error-boundary';

import AdminLayout from '../layouts/AdminLayout';
import ClientLayout from '../layouts/ClientLayout';
import AuthLayout from '../layouts/AuthLayout';

// Analytics configuration
const analytics = new Analytics({
  connectionString: process.env.VITE_APPINSIGHTS_CONNECTION_STRING,
  enableAutoRouteTracking: true
});

// Route metadata interface
interface RouteMeta {
  title: string;
  analyticsId: string;
  cacheStrategy: 'no-cache' | 'cache-first' | 'network-first';
}

// Enhanced route configuration interface
interface RouteConfig extends RouteObject {
  auth?: boolean;
  roles?: string[];
  meta?: RouteMeta;
  errorBoundary?: React.ComponentType;
}

// Lazy-loaded components with retry logic
const retryLazyLoad = (componentImport: () => Promise<any>) => {
  return new Promise((resolve, reject) => {
    const retryImport = (retries: number) => {
      componentImport()
        .then(resolve)
        .catch((error) => {
          if (retries > 0) {
            setTimeout(() => retryImport(retries - 1), 1000);
          } else {
            reject(error);
          }
        });
    };
    retryImport(3);
  });
};

// Lazy-loaded page components
const Login = lazy(() => retryLazyLoad(() => import('../pages/auth/Login')));
const Register = lazy(() => retryLazyLoad(() => import('../pages/auth/Register')));
const ForgotPassword = lazy(() => retryLazyLoad(() => import('../pages/auth/ForgotPassword')));
const AdminDashboard = lazy(() => retryLazyLoad(() => import('../pages/admin/Dashboard')));
const AdminClients = lazy(() => retryLazyLoad(() => import('../pages/admin/Clients')));
const AdminDocuments = lazy(() => retryLazyLoad(() => import('../pages/admin/Documents')));
const AdminAnalytics = lazy(() => retryLazyLoad(() => import('../pages/admin/Analytics')));
const AdminSettings = lazy(() => retryLazyLoad(() => import('../pages/admin/Settings')));
const ClientDashboard = lazy(() => retryLazyLoad(() => import('../pages/client/Dashboard')));
const ClientChat = lazy(() => retryLazyLoad(() => import('../pages/client/Chat')));
const ClientDocuments = lazy(() => retryLazyLoad(() => import('../pages/client/Documents')));
const ClientSettings = lazy(() => retryLazyLoad(() => import('../pages/client/Settings')));
const NotFound = lazy(() => retryLazyLoad(() => import('../pages/errors/NotFound')));

// Authentication routes
const AUTH_ROUTES: RouteConfig[] = [
  {
    path: '/login',
    element: <AuthLayout redirectTo="/"><Login /></AuthLayout>,
    meta: {
      title: 'Login',
      analyticsId: 'auth_login_view',
      cacheStrategy: 'no-cache'
    }
  },
  {
    path: '/register',
    element: <AuthLayout redirectTo="/"><Register /></AuthLayout>,
    meta: {
      title: 'Register',
      analyticsId: 'auth_register_view',
      cacheStrategy: 'no-cache'
    }
  },
  {
    path: '/forgot-password',
    element: <AuthLayout redirectTo="/"><ForgotPassword /></AuthLayout>,
    meta: {
      title: 'Forgot Password',
      analyticsId: 'auth_forgot_password_view',
      cacheStrategy: 'no-cache'
    }
  }
];

// Admin portal routes
const ADMIN_ROUTES: RouteConfig[] = [
  {
    path: '/admin',
    element: <AdminLayout><AdminDashboard /></AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Admin Dashboard',
      analyticsId: 'admin_dashboard_view',
      cacheStrategy: 'network-first'
    }
  },
  {
    path: '/admin/clients',
    element: <AdminLayout><AdminClients /></AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Client Management',
      analyticsId: 'admin_clients_view',
      cacheStrategy: 'network-first'
    }
  },
  {
    path: '/admin/documents',
    element: <AdminLayout><AdminDocuments /></AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Document Management',
      analyticsId: 'admin_documents_view',
      cacheStrategy: 'network-first'
    }
  },
  {
    path: '/admin/analytics',
    element: <AdminLayout><AdminAnalytics /></AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Analytics',
      analyticsId: 'admin_analytics_view',
      cacheStrategy: 'network-first'
    }
  },
  {
    path: '/admin/settings',
    element: <AdminLayout><AdminSettings /></AdminLayout>,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Admin Settings',
      analyticsId: 'admin_settings_view',
      cacheStrategy: 'network-first'
    }
  }
];

// Client portal routes
const CLIENT_ROUTES: RouteConfig[] = [
  {
    path: '/client',
    element: <ClientLayout><ClientDashboard /></ClientLayout>,
    auth: true,
    roles: ['CLIENT_ADMIN', 'REGULAR_USER'],
    meta: {
      title: 'Client Dashboard',
      analyticsId: 'client_dashboard_view',
      cacheStrategy: 'network-first'
    }
  },
  {
    path: '/client/chat',
    element: <ClientLayout><ClientChat /></ClientLayout>,
    auth: true,
    roles: ['CLIENT_ADMIN', 'REGULAR_USER'],
    meta: {
      title: 'Product Search',
      analyticsId: 'client_chat_view',
      cacheStrategy: 'network-first'
    }
  },
  {
    path: '/client/documents',
    element: <ClientLayout><ClientDocuments /></ClientLayout>,
    auth: true,
    roles: ['CLIENT_ADMIN', 'REGULAR_USER'],
    meta: {
      title: 'Documents',
      analyticsId: 'client_documents_view',
      cacheStrategy: 'network-first'
    }
  },
  {
    path: '/client/settings',
    element: <ClientLayout><ClientSettings /></ClientLayout>,
    auth: true,
    roles: ['CLIENT_ADMIN'],
    meta: {
      title: 'Settings',
      analyticsId: 'client_settings_view',
      cacheStrategy: 'network-first'
    }
  }
];

// Error routes
const ERROR_ROUTES: RouteConfig[] = [
  {
    path: '*',
    element: <NotFound />,
    meta: {
      title: 'Page Not Found',
      analyticsId: 'error_404_view',
      cacheStrategy: 'cache-first'
    }
  }
];

// Route validation function
const validateRouteAccess = (route: RouteConfig, user: any): boolean => {
  if (!route.auth) return true;
  if (!user) return false;
  if (!route.roles || route.roles.length === 0) return true;
  return route.roles.some(role => user.role === role);
};

// Generate final route configuration with error boundaries and analytics
const generateRouteConfig = (): RouteObject[] => {
  const allRoutes = [...AUTH_ROUTES, ...ADMIN_ROUTES, ...CLIENT_ROUTES, ...ERROR_ROUTES];

  return allRoutes.map(route => ({
    ...route,
    element: (
      <ErrorBoundary
        FallbackComponent={route.errorBoundary || NotFound}
        onError={(error) => {
          analytics.trackException({ error });
        }}
      >
        {route.element}
      </ErrorBoundary>
    ),
    loader: async () => {
      if (route.meta?.analyticsId) {
        analytics.trackPageView({ name: route.meta.title });
      }
      return null;
    }
  }));
};

// Export final route configuration
export const routes = generateRouteConfig();

export type { RouteConfig, RouteMeta };
export { validateRouteAccess };