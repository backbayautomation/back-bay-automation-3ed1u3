import React, { useCallback, useEffect } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import AdminLayout from '../../layouts/AdminLayout';
import ClientList from '../../components/admin/ClientManagement/ClientList';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../../types/auth';

// Props interface for the Clients page
interface ClientsPageProps {
  showArchived?: boolean;
  initialFilter?: string;
}

// Error boundary fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Box sx={{ p: 3 }}>
    <Alert 
      severity="error" 
      action={
        <button onClick={resetErrorBoundary}>Retry</button>
      }
    >
      {error.message}
    </Alert>
  </Box>
);

/**
 * Admin Clients page component implementing client management interface.
 * Provides comprehensive client management capabilities with role-based access control.
 */
const ClientsPage: React.FC<ClientsPageProps> = React.memo(({
  showArchived = false,
  initialFilter = ''
}) => {
  const { isAuthenticated, user, checkPermission } = useAuth();

  // Verify authentication and authorization
  useEffect(() => {
    if (isAuthenticated && user && !checkPermission(UserRole.SYSTEM_ADMIN)) {
      throw new Error('Unauthorized access. System admin privileges required.');
    }
  }, [isAuthenticated, user, checkPermission]);

  // Handle error logging
  const handleError = useCallback((error: Error) => {
    console.error('Client management error:', error);
    // TODO: Implement error reporting service integration
  }, []);

  // Loading state while checking authentication
  if (!isAuthenticated) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Unauthorized access
  if (!user || user.role !== UserRole.SYSTEM_ADMIN) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Unauthorized access. System admin privileges required.
        </Alert>
      </Box>
    );
  }

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => window.location.reload()}
    >
      <AdminLayout>
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1,
            p: 3,
            backgroundColor: 'background.default'
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{ 
              mb: 4,
              fontWeight: 'bold',
              color: 'text.primary'
            }}
          >
            Client Management
          </Typography>

          <ClientList />
        </Box>
      </AdminLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
ClientsPage.displayName = 'ClientsPage';

export default ClientsPage;