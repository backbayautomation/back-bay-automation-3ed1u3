import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Analytics } from '@azure/application-insights';
import { ErrorBoundary } from 'react-error-boundary';

import AdminLayout from '../layouts/AdminLayout';
import ClientLayout from '../layouts/ClientLayout';
import AuthLayout from '../layouts/AuthLayout';

// Route metadata interface for enhanced tracking and SEO
interface RouteMeta {
  title: string;
  analyticsId: string;
  cacheStrategy: 'no-cache' | 'cache-first' | 'network-first';
}

// Enhanced route configuration interface
interface RouteConfig extends RouteObject {
  auth: boolean;
  roles: string[];
  meta: RouteMeta;
  errorBoundary?: React.ComponentType;
}

// Lazy-loaded components with retry logic
const withRetry = (factory: () => Promise<any>, maxRetries = 3) => {
  return async () => {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        return await factory();
      } catch (error) {
        retries++;
        if (retries === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }
  };
};

// Authentication routes
const AUTH_ROUTES: RouteConfig[] = [
  {
    path: '/login',
    element: <AuthLayout redirectTo="/client" />,
    Component: lazy(() => withRetry(() => import('../pages/auth/Login'))),
    auth: false,
    roles: [],
    meta: {
      title: 'Login - AI Catalog Search',
      analyticsId: 'auth_login',
      cacheStrategy: 'no-cache'
    }
  },
  {
    path: '/mfa',
    element: <AuthLayout redirectTo="/client" />,
    Component: lazy(() => withRetry(() => import('../pages/auth/MFA'))),
    auth: true,
    roles: [],
    meta: {
      title: 'Two-Factor Authentication',
      analyticsId: 'auth_mfa',
      cacheStrategy: 'no-cache'
    }
  }
];

// Admin portal routes
const ADMIN_ROUTES: RouteConfig[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    auth: true,
    roles: ['SYSTEM_ADMIN'],
    meta: {
      title: 'Admin Dashboard',
      analyticsId: 'admin_dashboard',
      cacheStrategy: 'network-first'
    },
    children: [
      {
        path: 'dashboard',
        Component: lazy(() => withRetry(() => import('../pages/admin/Dashboard'))),
        meta: {
          title: 'Admin Dashboard',
          analyticsId: 'admin_dashboard_view',
          cacheStrategy: 'network-first'
        }
      },
      {
        path: 'clients',
        Component: lazy(() => withRetry(() => import('../pages/admin/Clients'))),
        meta: {
          title: 'Client Management',
          analyticsId: 'admin_clients',
          cacheStrategy: 'network-first'
        }
      },
      {
        path: 'documents',
        Component: lazy(() => withRetry(() => import('../pages/admin/Documents'))),
        meta: {
          title: 'Document Management',
          analyticsId: 'admin_documents',
          cacheStrategy: 'network-first'
        }
      },
      {
        path: 'analytics',
        Component: lazy(() => withRetry(() => import('../pages/admin/Analytics'))),
        meta: {
          title: 'System Analytics',
          analyticsId: 'admin_analytics',
          cacheStrategy: 'network-first'
        }
      }
    ]
  }
];

// Client portal routes
const CLIENT_ROUTES: RouteConfig[] = [
  {
    path: '/client',
    element: <ClientLayout />,
    auth: true,
    roles: ['CLIENT_ADMIN', 'REGULAR_USER'],
    meta: {
      title: 'Product Search',
      analyticsId: 'client_portal',
      cacheStrategy: 'network-first'
    },
    children: [
      {
        path: '',
        Component: lazy(() => withRetry(() => import('../pages/client/Home'))),
        meta: {
          title: 'Home - Product Search',
          analyticsId: 'client_home',
          cacheStrategy: 'network-first'
        }
      },
      {
        path: 'chat',
        Component: lazy(() => withRetry(() => import('../pages/client/Chat'))),
        meta: {
          title: 'Chat - Product Search',
          analyticsId: 'client_chat',
          cacheStrategy: 'no-cache'
        }
      },
      {
        path: 'documents',
        Component: lazy(() => withRetry(() => import('../pages/client/Documents'))),
        meta: {
          title: 'Documents - Product Search',
          analyticsId: 'client_documents',
          cacheStrategy: 'network-first'
        }
      }
    ]
  }
];

// Error routes
const ERROR_ROUTES: RouteConfig[] = [
  {
    path: '/error',
    Component: lazy(() => withRetry(() => import('../pages/error/ErrorPage'))),
    auth: false,
    roles: [],
    meta: {
      title: 'Error',
      analyticsId: 'error_page',
      cacheStrategy: 'no-cache'
    }
  },
  {
    path: '*',
    Component: lazy(() => withRetry(() => import('../pages/error/NotFound'))),
    auth: false,
    roles: [],
    meta: {
      title: '404 - Not Found',
      analyticsId: 'error_404',
      cacheStrategy: 'no-cache'
    }
  }
];

// Route validation and access control
const validateRouteAccess = (route: RouteConfig, user: any): boolean => {
  if (!route.auth) return true;
  if (!user) return false;
  if (route.roles.length === 0) return true;
  return route.roles.some(role => user.role === role);
};

// Generate final route configuration with error boundaries and analytics
const generateRouteConfig = (): RouteObject[] => {
  const allRoutes = [...AUTH_ROUTES, ...ADMIN_ROUTES, ...CLIENT_ROUTES, ...ERROR_ROUTES];

  return allRoutes.map(route => ({
    ...route,
    element: (
      <ErrorBoundary
        FallbackComponent={route.errorBoundary || ErrorPage}
        onError={(error) => {
          Analytics.trackException({
            error,
            severityLevel: 3,
            properties: {
              path: route.path,
              analyticsId: route.meta.analyticsId
            }
          });
        }}
      >
        {route.element}
      </ErrorBoundary>
    ),
    loader: async () => {
      Analytics.trackPageView({
        name: route.meta.title,
        properties: {
          path: route.path,
          analyticsId: route.meta.analyticsId
        }
      });
      return null;
    }
  }));
};

// Export final route configuration
export const routes = generateRouteConfig();

export default routes;