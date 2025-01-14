import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

import AdminLayout from '../../layouts/AdminLayout';
import ClientList from '../../components/admin/ClientManagement/ClientList';
import { useAuth } from '../../hooks/useAuth';

// Props interface for the Clients page
interface ClientsPageProps {
  showArchived?: boolean;
  initialFilter?: string;
}

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Box
    sx={{
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2
    }}
  >
    <Alert
      severity="error"
      action={
        <button
          onClick={resetErrorBoundary}
          style={{ marginLeft: '16px' }}
        >
          Try Again
        </button>
      }
    >
      {error.message}
    </Alert>
  </Box>
);

// Main Clients page component with memoization
const ClientsPage: React.FC<ClientsPageProps> = React.memo(({
  showArchived = false,
  initialFilter = ''
}) => {
  // Authentication and authorization
  const { isAuthenticated, user, checkPermission } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check user authorization
  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        setIsLoading(true);
        const hasPermission = await checkPermission('client_management');
        setIsAuthorized(hasPermission);
      } catch (err) {
        setError('Failed to verify permissions');
        console.error('Authorization check failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated && user) {
      checkAuthorization();
    }
  }, [isAuthenticated, user, checkPermission]);

  // Handle unauthorized access
  const handleUnauthorized = useCallback(() => {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          You do not have permission to access client management.
        </Alert>
      </Box>
    );
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <AdminLayout>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px'
          }}
        >
          <CircularProgress aria-label="Loading client management" />
        </Box>
      </AdminLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <AdminLayout>
        <Alert severity="error">{error}</Alert>
      </AdminLayout>
    );
  }

  // Unauthorized state
  if (!isAuthorized) {
    return (
      <AdminLayout>
        {handleUnauthorized()}
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          setError(null);
        }}
      >
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{ mb: 3 }}
            aria-label="Client Management"
          >
            Client Management
          </Typography>

          <ClientList />
        </Box>
      </ErrorBoundary>
    </AdminLayout>
  );
});

// Set display name for debugging
ClientsPage.displayName = 'ClientsPage';

export default ClientsPage;