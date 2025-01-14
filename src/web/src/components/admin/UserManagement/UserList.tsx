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
import { validateUserCreate, validateUserUpdate } from '../../../validators/user';
import { PaginationParams } from '../../../types/common';
import { LAYOUT_CONSTANTS, UI_CONSTANTS } from '../../../config/constants';

// Props interface with enhanced type safety
interface UserListProps {
  clientId?: string;
  onUserUpdate: (user: User) => Promise<void>;
  roles: UserRole[];
}

// Modal types for state management
type ModalType = 'create' | 'edit' | 'delete' | null;

// Component state interface
interface UserListState {
  users: User[];
  loading: boolean;
  error: string | null;
  selectedUser: User | null;
  modalType: ModalType;
  page: number;
  pageSize: number;
  total: number;
}

// Initial state
const initialState: UserListState = {
  users: [],
  loading: false,
  error: null,
  selectedUser: null,
  modalType: null,
  page: 1,
  pageSize: 10,
  total: 0,
};

// Memoized user list component with accessibility features
const UserList: React.FC<UserListProps> = React.memo(({
  clientId,
  onUserUpdate,
  roles,
}) => {
  // State management with TypeScript safety
  const [state, setState] = useState<UserListState>(initialState);

  // Memoized handlers for performance optimization
  const handlePageChange = useCallback((params: PaginationParams) => {
    setState(prev => ({
      ...prev,
      page: params.page,
      pageSize: params.pageSize,
      loading: true,
    }));
    // Fetch users with new pagination params
  }, []);

  const handleModalOpen = useCallback((type: ModalType, user?: User) => {
    setState(prev => ({
      ...prev,
      modalType: type,
      selectedUser: user || null,
    }));
  }, []);

  const handleModalClose = useCallback(() => {
    setState(prev => ({
      ...prev,
      modalType: null,
      selectedUser: null,
      error: null,
    }));
  }, []);

  // Form submission handlers with validation
  const handleCreateUser = useCallback(async (data: UserCreateInput) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const validationResult = await validateUserCreate(data);
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      // Add client ID for multi-tenant support
      const userData = clientId ? { ...data, clientId } : data;
      await onUserUpdate(userData as User);
      
      handleModalClose();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create user',
      }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [clientId, onUserUpdate, handleModalClose]);

  const handleUpdateUser = useCallback(async (data: UserUpdateInput) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const validationResult = await validateUserUpdate(data);
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0].message);
      }

      if (state.selectedUser) {
        await onUserUpdate({ ...state.selectedUser, ...data });
      }
      
      handleModalClose();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update user',
      }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [state.selectedUser, onUserUpdate, handleModalClose]);

  // Memoized modal content for performance
  const modalContent = useMemo(() => {
    const isEdit = state.modalType === 'edit';
    const title = isEdit ? 'Edit User' : 'Create New User';

    return (
      <Dialog
        open={state.modalType === 'create' || state.modalType === 'edit'}
        onClose={handleModalClose}
        maxWidth="sm"
        fullWidth
        aria-labelledby="user-form-dialog-title"
      >
        <DialogTitle id="user-form-dialog-title">{title}</DialogTitle>
        <DialogContent>
          {state.error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              role="alert"
            >
              {state.error}
            </Alert>
          )}
          <UserForm
            initialData={state.selectedUser}
            onSubmit={isEdit ? handleUpdateUser : handleCreateUser}
            onCancel={handleModalClose}
            isLoading={state.loading}
            clientId={clientId || ''}
            allowedRoles={roles}
          />
        </DialogContent>
      </Dialog>
    );
  }, [
    state.modalType,
    state.selectedUser,
    state.error,
    state.loading,
    clientId,
    roles,
    handleUpdateUser,
    handleCreateUser,
    handleModalClose,
  ]);

  // Render user list with accessibility features
  return (
    <Box
      sx={{
        padding: LAYOUT_CONSTANTS.SPACING_UNIT * 2,
        width: '100%',
      }}
      role="region"
      aria-label="User Management"
    >
      {/* Header with actions */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography
          variant="h5"
          component="h1"
          id="user-management-title"
        >
          User Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh user list">
            <IconButton
              onClick={() => setState(prev => ({ ...prev, loading: true }))}
              disabled={state.loading}
              aria-label="Refresh user list"
              size="large"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleModalOpen('create')}
            disabled={state.loading}
            sx={{ minWidth: UI_CONSTANTS.MIN_TOUCH_TARGET }}
          >
            Add User
          </Button>
        </Box>
      </Box>

      {/* User table with accessibility support */}
      <UserTable
        users={state.users}
        page={state.page}
        pageSize={state.pageSize}
        total={state.total}
        onPageChange={handlePageChange}
        onEdit={(user) => handleModalOpen('edit', user)}
        onDelete={(user) => handleModalOpen('delete', user)}
        loading={state.loading}
        ariaLabel="User management table"
        ariaDescription="Table displaying user information with sorting and filtering capabilities"
      />

      {/* Modal forms with accessibility */}
      {modalContent}
    </Box>
  );
});

// Display name for debugging
UserList.displayName = 'UserList';

export default UserList;