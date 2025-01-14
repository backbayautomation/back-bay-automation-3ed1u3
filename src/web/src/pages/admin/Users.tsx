import React, { useCallback, useEffect, useState } from 'react';
import { Typography, Box, Alert } from '@mui/material'; // v5.14.0
import { withErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { ApplicationInsights } from '@azure/application-insights-web'; // v2.8.3

import AdminLayout from '../../layouts/AdminLayout';
import UserList from '../../components/admin/UserManagement/UserList';
import { User, UserRole } from '../../types/user';
import { useAuth } from '../../hooks/useAuth';
import { LAYOUT_CONSTANTS } from '../../config/constants';

// Props interface with enhanced type safety
interface UsersPageProps {
  testId?: string;
  onError?: (error: Error) => void;
}

// Initialize Application Insights for analytics
const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.VITE_APPINSIGHTS_KEY || '',
    enableAutoRouteTracking: true,
  },
});

// Main Users page component with error boundary protection
const UsersPage: React.FC<UsersPageProps> = React.memo(({ 
  testId = 'users-page',
  onError 
}) => {
  // Authentication and state management
  const { user, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Track page view on mount
  useEffect(() => {
    appInsights.trackPageView({
      name: 'Admin Users Page',
      properties: {
        userRole: user?.role,
        clientId: user?.clientId,
      },
    });
  }, [user]);

  // Handle user updates with analytics tracking
  const handleUserUpdate = useCallback(async (updatedUser: User) => {
    try {
      // API call would go here
      appInsights.trackEvent({
        name: 'UserUpdate',
        properties: {
          adminId: user?.id,
          userId: updatedUser.id,
          action: updatedUser.id ? 'update' : 'create',
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user';
      setError(errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      
      appInsights.trackException({
        error: error instanceof Error ? error : new Error(errorMessage),
        properties: {
          component: 'UsersPage',
          action: 'handleUserUpdate',
        },
      });
    }
  }, [user, onError]);

  // Define allowed roles based on current user's role
  const getAllowedRoles = useCallback((): UserRole[] => {
    if (user?.role === UserRole.SYSTEM_ADMIN) {
      return [UserRole.SYSTEM_ADMIN, UserRole.CLIENT_ADMIN, UserRole.REGULAR_USER];
    }
    if (user?.role === UserRole.CLIENT_ADMIN) {
      return [UserRole.CLIENT_ADMIN, UserRole.REGULAR_USER];
    }
    return [UserRole.REGULAR_USER];
  }, [user]);

  // Render error state if not authenticated
  if (!isAuthenticated) {
    return (
      <Box 
        sx={{ 
          padding: LAYOUT_CONSTANTS.SPACING_UNIT * 2,
          textAlign: 'center' 
        }}
        role="alert"
      >
        <Typography variant="h5" color="error">
          Authentication Required
        </Typography>
      </Box>
    );
  }

  return (
    <AdminLayout>
      <Box
        component="main"
        sx={{
          padding: LAYOUT_CONSTANTS.SPACING_UNIT * 2,
          width: '100%',
        }}
        data-testid={testId}
        role="main"
        aria-label="User Management Page"
      >
        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ marginBottom: 2 }}
            role="alert"
          >
            {error}
          </Alert>
        )}

        <UserList
          clientId={user?.clientId || undefined}
          onUserUpdate={handleUserUpdate}
          roles={getAllowedRoles()}
        />
      </Box>
    </AdminLayout>
  );
});

// Error boundary wrapper
const UsersPageWithErrorBoundary = withErrorBoundary(UsersPage, {
  fallback: (
    <Box 
      sx={{ 
        padding: LAYOUT_CONSTANTS.SPACING_UNIT * 2,
        textAlign: 'center' 
      }}
      role="alert"
    >
      <Typography variant="h5" color="error">
        Error loading user management page. Please refresh the page or contact support.
      </Typography>
    </Box>
  ),
  onError: (error) => {
    appInsights.trackException({
      error,
      properties: {
        component: 'UsersPage',
        severity: 'Critical',
      },
    });
  },
});

// Set display name for debugging
UsersPageWithErrorBoundary.displayName = 'UsersPage';

export default UsersPageWithErrorBoundary;