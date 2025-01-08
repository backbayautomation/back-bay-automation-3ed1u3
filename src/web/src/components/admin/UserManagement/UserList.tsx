import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material'; // v5.14.0
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material'; // v5.14.0

import UserTable from './UserTable';
import UserForm from './UserForm';
import { User, UserRole, UserCreateInput, UserUpdateInput } from '../../../types/user';
import { sanitizeString } from '../../../utils/validation';
import { UI_CONSTANTS } from '../../../config/constants';

interface UserListProps {
  clientId?: string;
  onUserUpdate: (user: User) => Promise<void>;
  roles: UserRole[];
}

interface UserListState {
  users: User[];
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  total: number;
  selectedUser: User | null;
  isFormOpen: boolean;
  isDeleteDialogOpen: boolean;
  userToDelete: User | null;
}

const UserList: React.FC<UserListProps> = React.memo(({
  clientId,
  onUserUpdate,
  roles
}) => {
  // State management with TypeScript safety
  const [state, setState] = useState<UserListState>({
    users: [],
    loading: false,
    error: null,
    page: 1,
    pageSize: 10,
    total: 0,
    selectedUser: null,
    isFormOpen: false,
    isDeleteDialogOpen: false,
    userToDelete: null
  });

  // Memoized handlers for performance optimization
  const handlePageChange = useCallback(async ({ page, pageSize }) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      // Implement pagination logic here
      setState(prev => ({
        ...prev,
        page,
        pageSize,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch users'
      }));
    }
  }, []);

  const handleCreateUser = useCallback(async (data: UserCreateInput) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // Sanitize input data
      const sanitizedData = {
        ...data,
        fullName: sanitizeString(data.fullName),
        email: sanitizeString(data.email)
      };
      await onUserUpdate(sanitizedData as User);
      setState(prev => ({
        ...prev,
        loading: false,
        isFormOpen: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to create user'
      }));
    }
  }, [onUserUpdate]);

  const handleUpdateUser = useCallback(async (data: UserUpdateInput) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (!state.selectedUser) return;
      
      const sanitizedData = {
        ...data,
        fullName: data.fullName ? sanitizeString(data.fullName) : undefined,
        email: data.email ? sanitizeString(data.email) : undefined
      };
      
      await onUserUpdate({
        ...state.selectedUser,
        ...sanitizedData
      } as User);
      
      setState(prev => ({
        ...prev,
        loading: false,
        isFormOpen: false,
        selectedUser: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to update user'
      }));
    }
  }, [onUserUpdate, state.selectedUser]);

  const handleDeleteUser = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      if (!state.userToDelete) return;
      
      await onUserUpdate({
        ...state.userToDelete,
        isActive: false
      });
      
      setState(prev => ({
        ...prev,
        loading: false,
        isDeleteDialogOpen: false,
        userToDelete: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to delete user'
      }));
    }
  }, [onUserUpdate, state.userToDelete]);

  // Memoized allowed roles based on client context
  const allowedRoles = useMemo(() => {
    if (!clientId) return roles;
    return roles.filter(role => 
      role !== UserRole.SYSTEM_ADMIN && 
      role !== UserRole.API_SERVICE
    );
  }, [clientId, roles]);

  return (
    <Box
      role="region"
      aria-label="User management"
      sx={{ position: 'relative', minHeight: '400px' }}
    >
      {/* Error Alert */}
      {state.error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setState(prev => ({ ...prev, error: null }))}
        >
          {state.error}
        </Alert>
      )}

      {/* Action Toolbar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2
        }}
      >
        <Typography variant="h6" component="h2">
          User Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh user list">
            <IconButton
              onClick={() => handlePageChange({ page: 1, pageSize: state.pageSize })}
              disabled={state.loading}
              aria-label="Refresh user list"
              sx={{
                minWidth: UI_CONSTANTS.MIN_TOUCH_TARGET,
                minHeight: UI_CONSTANTS.MIN_TOUCH_TARGET
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setState(prev => ({ ...prev, isFormOpen: true }))}
            disabled={state.loading}
            sx={{
              minWidth: UI_CONSTANTS.MIN_TOUCH_TARGET,
              minHeight: UI_CONSTANTS.MIN_TOUCH_TARGET
            }}
          >
            Add User
          </Button>
        </Box>
      </Box>

      {/* User Table */}
      <UserTable
        users={state.users}
        page={state.page}
        pageSize={state.pageSize}
        total={state.total}
        onPageChange={handlePageChange}
        onEdit={(user) => setState(prev => ({
          ...prev,
          selectedUser: user,
          isFormOpen: true
        }))}
        onDelete={(user) => setState(prev => ({
          ...prev,
          userToDelete: user,
          isDeleteDialogOpen: true
        }))}
        loading={state.loading}
        ariaLabel="User management table"
      />

      {/* User Form Dialog */}
      <Dialog
        open={state.isFormOpen}
        onClose={() => setState(prev => ({
          ...prev,
          isFormOpen: false,
          selectedUser: null
        }))}
        aria-labelledby="user-form-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="user-form-dialog-title">
          {state.selectedUser ? 'Edit User' : 'Create User'}
        </DialogTitle>
        <DialogContent>
          <UserForm
            initialData={state.selectedUser}
            onSubmit={state.selectedUser ? handleUpdateUser : handleCreateUser}
            onCancel={() => setState(prev => ({
              ...prev,
              isFormOpen: false,
              selectedUser: null
            }))}
            isLoading={state.loading}
            clientId={clientId || ''}
            allowedRoles={allowedRoles}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={state.isDeleteDialogOpen}
        onClose={() => setState(prev => ({
          ...prev,
          isDeleteDialogOpen: false,
          userToDelete: null
        }))}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm User Deletion
        </DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            Are you sure you want to delete user {state.userToDelete?.fullName}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setState(prev => ({
              ...prev,
              isDeleteDialogOpen: false,
              userToDelete: null
            }))}
            disabled={state.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteUser}
            color="error"
            disabled={state.loading}
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

UserList.displayName = 'UserList';

export default UserList;