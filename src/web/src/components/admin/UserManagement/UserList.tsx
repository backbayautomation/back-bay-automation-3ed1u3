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
  useTheme,
} from '@mui/material'; // v5.14.0
import { Add as AddIcon, PersonAdd } from '@mui/icons-material'; // v5.14.0

import { UserTable } from './UserTable';
import { UserForm } from './UserForm';
import type { User, UserRole, UserCreateInput, UserUpdateInput } from '../../../types/user';
import { validateUserCreate, validateUserUpdate } from '../../../validators/user';
import { UI_CONSTANTS } from '../../../config/constants';

export interface UserListProps {
  clientId?: string;
  onUserUpdate: (user: User) => Promise<void>;
  roles: UserRole[];
}

/**
 * Enterprise-grade user management component with accessibility support and performance optimization
 * Implements WCAG 2.1 Level AA compliance and role-based access control
 */
const UserList: React.FC<UserListProps> = React.memo(({
  clientId,
  onUserUpdate,
  roles
}) => {
  const theme = useTheme();

  // State management with TypeScript type safety
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Memoized pagination handler for performance
  const handlePageChange = useCallback(({ page: newPage, pageSize: newPageSize }) => {
    setPage(newPage);
    setPageSize(newPageSize);
  }, []);

  // Form handlers with error management
  const handleFormOpen = useCallback((user?: User) => {
    setSelectedUser(user || null);
    setIsFormOpen(true);
    setError(null);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setSelectedUser(null);
    setError(null);
  }, []);

  const handleDeleteDialogOpen = useCallback((user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDeleteDialogClose = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
  }, []);

  // User management handlers with validation
  const handleCreateUser = useCallback(async (data: UserCreateInput) => {
    try {
      setLoading(true);
      setError(null);

      const validationResult = await validateUserCreate(data);
      if (!validationResult.success) {
        setError('Validation failed. Please check your input.');
        return;
      }

      await onUserUpdate({ ...data, id: '', createdAt: '', updatedAt: '' } as User);
      handleFormClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating the user');
    } finally {
      setLoading(false);
    }
  }, [onUserUpdate, handleFormClose]);

  const handleUpdateUser = useCallback(async (data: UserUpdateInput) => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      setError(null);

      const validationResult = await validateUserUpdate(data);
      if (!validationResult.success) {
        setError('Validation failed. Please check your input.');
        return;
      }

      await onUserUpdate({ ...selectedUser, ...data });
      handleFormClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating the user');
    } finally {
      setLoading(false);
    }
  }, [selectedUser, onUserUpdate, handleFormClose]);

  const handleDeleteUser = useCallback(async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      setError(null);

      await onUserUpdate({ ...selectedUser, isActive: false });
      handleDeleteDialogClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while deleting the user');
    } finally {
      setLoading(false);
    }
  }, [selectedUser, onUserUpdate, handleDeleteDialogClose]);

  // Memoized styles for performance
  const styles = useMemo(() => ({
    root: {
      padding: theme.spacing(3),
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(3),
    },
    addButton: {
      minWidth: UI_CONSTANTS.MIN_TOUCH_TARGET,
      minHeight: UI_CONSTANTS.MIN_TOUCH_TARGET,
    },
  }), [theme]);

  return (
    <Box sx={styles.root} role="region" aria-label="User Management">
      <Box sx={styles.header}>
        <Typography variant="h5" component="h1" id="user-management-title">
          User Management
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleFormOpen()}
          sx={styles.addButton}
          aria-label="Add new user"
        >
          Add User
        </Button>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ marginBottom: theme.spacing(2) }}
          role="alert"
        >
          {error}
        </Alert>
      )}

      <UserTable
        users={users}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={handlePageChange}
        onEdit={handleFormOpen}
        onDelete={handleDeleteDialogOpen}
        loading={loading}
        ariaLabel="User management table"
        ariaDescription="Table displaying user information with sorting and filtering capabilities"
      />

      <Dialog
        open={isFormOpen}
        onClose={handleFormClose}
        aria-labelledby="user-form-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="user-form-dialog-title">
          {selectedUser ? 'Edit User' : 'Create User'}
        </DialogTitle>
        <DialogContent>
          <UserForm
            initialData={selectedUser}
            onSubmit={selectedUser ? handleUpdateUser : handleCreateUser}
            onCancel={handleFormClose}
            isLoading={loading}
            clientId={clientId || ''}
            allowedRoles={roles}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={handleDeleteDialogClose}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete User
        </DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            Are you sure you want to delete {selectedUser?.fullName}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteDialogClose}
            disabled={loading}
            aria-label="Cancel delete user"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteUser}
            color="error"
            disabled={loading}
            aria-label="Confirm delete user"
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