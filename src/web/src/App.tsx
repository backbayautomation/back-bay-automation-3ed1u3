import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';
import AuthLayout from './layouts/AuthLayout';

// Providers
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Analytics
import { trackRouteChange } from './services/analytics';

// Lazy-loaded components for code splitting
const Login = lazy(() => import('./pages/auth/Login'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

// Security headers configuration
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:;",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
    <h2>Application Error</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
  </div>
);

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    Loading...
  </div>
);

// Route change tracker component
const RouteTracker: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    trackRouteChange({
      path: location.pathname,
      timestamp: new Date().toISOString()
    });
  }, [location]);

  return null;
};

/**
 * Root application component implementing the dual-portal system with
 * enhanced security features and performance optimizations.
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Helmet>
        {Object.entries(SECURITY_HEADERS).map(([key, value]) => (
          <meta key={key} httpEquiv={key} content={value} />
        ))}
        <title>AI-Powered Product Catalog Search</title>
      </Helmet>

      <BrowserRouter>
        <ThemeProvider>
          <CssBaseline />
          <AuthProvider>
            <RouteTracker />
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Authentication Routes */}
                <Route element={<AuthLayout redirectTo="/client" />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                </Route>

                {/* Admin Portal Routes */}
                <Route
                  path="/admin/*"
                  element={
                    <AdminLayout>
                      <Routes>
                        {/* Admin routes will be defined in AdminLayout */}
                      </Routes>
                    </AdminLayout>
                  }
                />

                {/* Client Portal Routes */}
                <Route
                  path="/client/*"
                  element={
                    <ClientLayout>
                      <Routes>
                        {/* Client routes will be defined in ClientLayout */}
                      </Routes>
                    </ClientLayout>
                  }
                />

                {/* Default Redirect */}
                <Route path="/" element={<Navigate to="/client" replace />} />
                
                {/* 404 Route */}
                <Route path="*" element={
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2>404 - Page Not Found</h2>
                  </div>
                } />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;