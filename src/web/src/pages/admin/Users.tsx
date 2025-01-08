import React, { useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material'; // v5.14.0
import { withErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { ApplicationInsights } from '@azure/application-insights-web'; // v2.8.3

import AdminLayout from '../../layouts/AdminLayout';
import UserList from '../../components/admin/UserManagement/UserList';
import { useAuth } from '../../hooks/useAuth';
import { User, UserRole } from '../../types/user';

// Initialize Application Insights
const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.VITE_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
  },
});
appInsights.loadAppInsights();

interface UsersPageProps {
  testId?: string;
  onError?: (error: Error) => void;
}

const UsersPage: React.FC<UsersPageProps> = React.memo(({ 
  testId = 'admin-users-page',
  onError 
}) => {
  const { user, isAuthenticated } = useAuth();

  // Track page view
  useEffect(() => {
    appInsights.trackPageView({
      name: 'Admin - Users Page',
      properties: {
        userRole: user?.role,
        clientId: user?.clientId,
      },
    });
  }, [user]);

  // Handle user updates with analytics tracking
  const handleUserUpdate = useCallback(async (updatedUser: User) => {
    try {
      appInsights.trackEvent({
        name: 'User Update',
        properties: {
          adminId: user?.id,
          userId: updatedUser.id,
          action: updatedUser.id ? 'update' : 'create',
        },
      });

      // API call would go here
      // await updateUser(updatedUser);

    } catch (error) {
      appInsights.trackException({
        error: error as Error,
        properties: {
          adminId: user?.id,
          userId: updatedUser.id,
          action: 'user_update_failed',
        },
      });
      throw error;
    }
  }, [user]);

  // Get allowed roles based on current user's role
  const getAllowedRoles = useCallback(() => {
    if (user?.role === UserRole.SYSTEM_ADMIN) {
      return [
        UserRole.SYSTEM_ADMIN,
        UserRole.CLIENT_ADMIN,
        UserRole.REGULAR_USER,
      ];
    }
    if (user?.role === UserRole.CLIENT_ADMIN) {
      return [
        UserRole.CLIENT_ADMIN,
        UserRole.REGULAR_USER,
      ];
    }
    return [UserRole.REGULAR_USER];
  }, [user]);

  return (
    <AdminLayout>
      <Box
        component="main"
        role="main"
        aria-label="User Management"
        data-testid={testId}
        sx={{
          p: 3,
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            mb: 3,
            fontWeight: 500,
            color: 'text.primary',
          }}
        >
          User Management
        </Typography>

        <Box
          sx={{
            backgroundColor: 'background.paper',
            borderRadius: 1,
            boxShadow: 1,
            overflow: 'hidden',
          }}
        >
          <UserList
            clientId={user?.clientId || undefined}
            onUserUpdate={handleUserUpdate}
            roles={getAllowedRoles()}
          />
        </Box>
      </Box>
    </AdminLayout>
  );
});

// Error boundary wrapper
const UsersPageWithErrorBoundary = withErrorBoundary(UsersPage, {
  fallback: (
    <Box
      role="alert"
      aria-label="Error Message"
      sx={{
        p: 3,
        color: 'error.main',
        textAlign: 'center',
      }}
    >
      <Typography variant="h6">
        An error occurred while loading the user management page.
        Please try refreshing the page.
      </Typography>
    </Box>
  ),
  onError: (error, componentStack) => {
    appInsights.trackException({
      error,
      properties: {
        componentStack,
        location: 'UsersPage',
      },
    });
  },
});

// Display name for debugging
UsersPageWithErrorBoundary.displayName = 'UsersPage';

export default UsersPageWithErrorBoundary;