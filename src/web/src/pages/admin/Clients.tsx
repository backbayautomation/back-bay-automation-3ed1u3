import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material'; // v5.14.0
import { withErrorBoundary } from 'react-error-boundary'; // v4.0.11
import AdminLayout from '../../layouts/AdminLayout';
import ClientList from '../../components/admin/ClientManagement/ClientList';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth';

// Error boundary fallback component with accessibility support
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Box
    role="alert"
    aria-live="assertive"
    sx={{
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2
    }}
  >
    <Typography variant="h6" color="error">
      Error loading client management page
    </Typography>
    <Typography color="error">{error.message}</Typography>
    <button
      onClick={resetErrorBoundary}
      style={{
        padding: '8px 16px',
        borderRadius: '4px',
        backgroundColor: '#0066CC',
        color: 'white',
        border: 'none',
        cursor: 'pointer'
      }}
    >
      Try Again
    </button>
  </Box>
);

// Props interface for the Clients page component
interface ClientsPageProps {
  showArchived?: boolean;
  initialFilter?: string;
}

// Main Clients page component with security and accessibility features
const ClientsPage: React.FC<ClientsPageProps> = React.memo(({
  showArchived = false,
  initialFilter = ''
}) => {
  const { isAuthenticated, user, checkPermission } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verify authentication and permissions on mount
  useEffect(() => {
    const verifyAccess = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isAuthenticated) {
          throw new Error('Authentication required');
        }

        if (!user || !checkPermission('MANAGE_CLIENTS')) {
          throw new Error('Insufficient permissions');
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Access verification failed');
        setIsLoading(false);
      }
    };

    verifyAccess();
  }, [isAuthenticated, user, checkPermission]);

  // Handle authentication errors
  if (!isAuthenticated || !user) {
    return (
      <AdminLayout>
        <Alert 
          severity="error"
          sx={{ m: 2 }}
          role="alert"
        >
          Please log in to access client management.
        </Alert>
      </AdminLayout>
    );
  }

  // Handle permission errors
  if (user.role !== UserRole.SYSTEM_ADMIN) {
    return (
      <AdminLayout>
        <Alert 
          severity="error"
          sx={{ m: 2 }}
          role="alert"
        >
          You do not have permission to access client management.
        </Alert>
      </AdminLayout>
    );
  }

  // Handle loading state
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
          <CircularProgress 
            aria-label="Loading client management"
            size={40}
          />
        </Box>
      </AdminLayout>
    );
  }

  // Handle error state
  if (error) {
    return (
      <AdminLayout>
        <Alert 
          severity="error"
          sx={{ m: 2 }}
          role="alert"
        >
          {error}
        </Alert>
      </AdminLayout>
    );
  }

  // Render main content
  return (
    <AdminLayout>
      <Box
        component="main"
        role="main"
        aria-label="Client Management"
        sx={{
          flexGrow: 1,
          width: '100%',
          backgroundColor: 'background.default',
          overflow: 'auto'
        }}
      >
        <ClientList />
      </Box>
    </AdminLayout>
  );
});

// Add display name for debugging
ClientsPage.displayName = 'ClientsPage';

// Wrap with error boundary for production error handling
const ClientsPageWithErrorBoundary = withErrorBoundary(ClientsPage, {
  FallbackComponent: ErrorFallback,
  onError: (error) => {
    console.error('[ClientsPage] Error:', error);
    // Implement error reporting service integration here
  }
});

export type { ClientsPageProps };
export default ClientsPageWithErrorBoundary;