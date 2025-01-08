import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { withErrorBoundary } from 'react-error-boundary';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';
import AuthLayout from './layouts/AuthLayout';

// Providers
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Analytics
import { analyticsService } from './services/analytics';

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

// Route change tracking component
const RouteTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    analyticsService.trackRouteChange({
      path: location.pathname,
      timestamp: new Date().toISOString()
    }).catch(error => {
      console.error('Analytics tracking error:', error);
    });
  }, [location]);

  return null;
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Application Error</h2>
    <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
  </div>
);

// Main App component with enhanced security and monitoring
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Helmet>
            {/* Security headers */}
            {Object.entries(SECURITY_HEADERS).map(([key, value]) => (
              <meta key={key} httpEquiv={key} content={value} />
            ))}
            {/* Basic meta tags */}
            <title>AI-Powered Product Catalog Search</title>
            <meta name="description" content="Enterprise product catalog search system" />
            <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
          </Helmet>

          <CssBaseline />
          <RouteTracker />

          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              {/* Authentication routes */}
              <Route path="/login" element={
                <AuthLayout redirectTo="/client">
                  <Login />
                </AuthLayout>
              } />
              <Route path="/forgot-password" element={
                <AuthLayout redirectTo="/client">
                  <ForgotPassword />
                </AuthLayout>
              } />
              <Route path="/reset-password" element={
                <AuthLayout redirectTo="/client">
                  <ResetPassword />
                </AuthLayout>
              } />

              {/* Admin portal routes */}
              <Route path="/admin/*" element={
                <AdminLayout>
                  <Routes>
                    <Route path="dashboard" element={<div>Admin Dashboard</div>} />
                    <Route path="clients" element={<div>Client Management</div>} />
                    <Route path="documents" element={<div>Document Management</div>} />
                    <Route path="analytics" element={<div>Analytics Dashboard</div>} />
                    <Route path="settings" element={<div>Admin Settings</div>} />
                    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                  </Routes>
                </AdminLayout>
              } />

              {/* Client portal routes */}
              <Route path="/client/*" element={
                <ClientLayout>
                  <Routes>
                    <Route path="/" element={<div>Client Dashboard</div>} />
                    <Route path="chat" element={<div>Chat Interface</div>} />
                    <Route path="documents" element={<div>Document Library</div>} />
                    <Route path="settings" element={<div>Client Settings</div>} />
                    <Route path="*" element={<Navigate to="/client" replace />} />
                  </Routes>
                </ClientLayout>
              } />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/client" replace />} />
              <Route path="*" element={<Navigate to="/client" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

// Enhanced App component with error boundary
const EnhancedApp = withErrorBoundary(App, {
  FallbackComponent: ErrorFallback,
  onError: (error) => {
    console.error('Application Error:', error);
    analyticsService.trackError({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }).catch(console.error);
  }
});

export default EnhancedApp;