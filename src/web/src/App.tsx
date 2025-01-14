import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';

// Layouts with code splitting
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const ClientLayout = lazy(() => import('./layouts/ClientLayout'));
const AuthLayout = lazy(() => import('./layouts/AuthLayout'));

// Context providers
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Analytics tracking
import { trackRouteChange } from './services/analytics';

// Security headers configuration
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.example.com;",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Application Error</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Refresh Application</button>
  </div>
);

// Loading component for code splitting
const SuspenseFallback: React.FC = () => (
  <div role="progressbar" aria-label="Loading application">
    Loading...
  </div>
);

// Route change tracking component
const RouteTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  React.useEffect(() => {
    trackRouteChange({
      path: location.pathname,
      timestamp: new Date().toISOString()
    });
  }, [location]);

  return <>{children}</>;
};

/**
 * Root application component implementing dual-portal system with enhanced security
 * and performance optimizations
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Helmet>
        {Object.entries(SECURITY_HEADERS).map(([key, value]) => (
          <meta key={key} httpEquiv={key} content={value} />
        ))}
        <title>AI-Powered Product Catalog Search</title>
        <meta name="description" content="Enterprise product catalog search system" />
      </Helmet>

      <BrowserRouter>
        <RouteTracker>
          <ThemeProvider>
            <AuthProvider>
              <CssBaseline />
              <Suspense fallback={<SuspenseFallback />}>
                <Routes>
                  {/* Authentication Routes */}
                  <Route path="/login" element={
                    <AuthLayout redirectTo="/client">
                      {/* Login component will be loaded here */}
                    </AuthLayout>
                  } />
                  <Route path="/forgot-password" element={
                    <AuthLayout redirectTo="/login">
                      {/* ForgotPassword component will be loaded here */}
                    </AuthLayout>
                  } />
                  <Route path="/reset-password" element={
                    <AuthLayout redirectTo="/login">
                      {/* ResetPassword component will be loaded here */}
                    </AuthLayout>
                  } />

                  {/* Admin Portal Routes */}
                  <Route path="/admin/*" element={
                    <AdminLayout>
                      {/* Admin routes will be handled by AdminLayout */}
                    </AdminLayout>
                  } />

                  {/* Client Portal Routes */}
                  <Route path="/client/*" element={
                    <ClientLayout>
                      {/* Client routes will be handled by ClientLayout */}
                    </ClientLayout>
                  } />

                  {/* Default redirect */}
                  <Route path="/" element={<Navigate to="/client" replace />} />
                  
                  {/* Catch-all route for 404 */}
                  <Route path="*" element={
                    <div role="alert">
                      <h2>404 - Page Not Found</h2>
                      <p>The requested page does not exist.</p>
                    </div>
                  } />
                </Routes>
              </Suspense>
            </AuthProvider>
          </ThemeProvider>
        </RouteTracker>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;