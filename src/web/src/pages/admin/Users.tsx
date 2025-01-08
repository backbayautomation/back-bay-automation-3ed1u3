import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useApplicationInsights } from '@azure/application-insights-web';
import { ErrorBoundary } from 'react-error-boundary';
import AdminLayout from '../../layouts/AdminLayout';
import UserList from '../../components/admin/UserManagement/UserList';
import { useAuth } from '../../hooks/useAuth';
import type { User, UserRole } from '../../types/user';

// Props interface with TypeScript strict typing
interface UsersPageProps {
  testId?: string;
  onError?: (error: Error) => void;
}

// Error boundary fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Box 
    role="alert" 
    sx={{ 
      padding: 3,
      color: 'error.main',
      backgroundColor: 'error.light' 
    }}
  >
    <Typography variant="h6" component="h2" gutterBottom>
      Error Loading User Management
    </Typography>
    <Typography variant="body1">{error.message}</Typography>
  </Box>
);

/**
 * Admin Users page component providing comprehensive user management functionality
 * with role-based access control, enhanced accessibility, and analytics tracking.
 */
const UsersPage: React.FC<UsersPageProps> = React.memo(({ 
  testId = 'admin-users-page',
  onError 
}) => {
  // Hooks initialization
  const { appInsights } = useApplicationInsights();
  const { user, hasRole } = useAuth();
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>([]);

  // Track page view on component mount
  useEffect(() => {
    appInsights?.trackPageView({
      name: 'Admin - User Management',
      uri: window.location.pathname,
      properties: {
        userRole: user?.role,
        clientId: user?.clientId
      }
    });
  }, [appInsights, user]);

  // Set allowed roles based on current user's role
  useEffect(() => {
    if (hasRole('SYSTEM_ADMIN')) {
      setAllowedRoles([
        UserRole.SYSTEM_ADMIN,
        UserRole.CLIENT_ADMIN,
        UserRole.REGULAR_USER
      ]);
    } else if (hasRole('CLIENT_ADMIN')) {
      setAllowedRoles([
        UserRole.CLIENT_ADMIN,
        UserRole.REGULAR_USER
      ]);
    } else {
      setAllowedRoles([UserRole.REGULAR_USER]);
    }
  }, [hasRole]);

  // Handle user updates with analytics tracking
  const handleUserUpdate = useCallback(async (updatedUser: User) => {
    try {
      // Track user management action
      appInsights?.trackEvent({
        name: 'UserManagementAction',
        properties: {
          actionType: updatedUser.id ? 'update' : 'create',
          userRole: user?.role,
          targetUserRole: updatedUser.role,
          clientId: user?.clientId
        }
      });

      // Additional user update logic would go here
      // This would typically involve an API call to update the user

    } catch (error) {
      appInsights?.trackException({
        error: error as Error,
        severityLevel: 2,
        properties: {
          component: 'UsersPage',
          action: 'handleUserUpdate',
          userId: updatedUser.id
        }
      });
      
      if (onError && error instanceof Error) {
        onError(error);
      }
      throw error;
    }
  }, [appInsights, user, onError]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        appInsights?.trackException({
          error,
          severityLevel: 3,
          properties: {
            component: 'UsersPage',
            userId: user?.id
          }
        });
        if (onError) onError(error);
      }}
    >
      <AdminLayout>
        <Box
          component="main"
          role="main"
          aria-label="User Management"
          data-testid={testId}
          sx={{
            padding: 3,
            width: '100%',
            maxWidth: 'lg',
            margin: '0 auto'
          }}
        >
          <UserList
            clientId={user?.clientId || undefined}
            onUserUpdate={handleUserUpdate}
            roles={allowedRoles}
          />
        </Box>
      </AdminLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
UsersPage.displayName = 'UsersPage';

export default UsersPage;