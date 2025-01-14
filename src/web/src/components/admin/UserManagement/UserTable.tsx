import React, { useMemo } from 'react';
import { Chip, IconButton, Tooltip } from '@mui/material'; // v5.14.0
import { Edit, Delete } from '@mui/icons-material'; // v5.14.0

import DataTable, { Column } from '../../common/Tables/DataTable';
import { User, UserRole } from '../../../types/user';
import { PaginationParams } from '../../../types/common';

// Props interface with enhanced accessibility support
interface UserTableProps {
  users: User[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (params: PaginationParams) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  loading: boolean;
  ariaLabel?: string;
  ariaDescription?: string;
}

// Helper function to get accessible role labels
const getRoleLabel = (role: UserRole): string => {
  const labels = {
    [UserRole.SYSTEM_ADMIN]: 'System Administrator',
    [UserRole.CLIENT_ADMIN]: 'Client Administrator',
    [UserRole.REGULAR_USER]: 'Regular User',
    [UserRole.API_SERVICE]: 'API Service',
  };
  return labels[role] || 'Unknown Role';
};

// Memoized user table component with accessibility features
const UserTable: React.FC<UserTableProps> = React.memo(({
  users,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
  loading,
  ariaLabel = 'User management table',
  ariaDescription = 'Table displaying user information with sorting and filtering capabilities'
}) => {
  // Memoized table columns with accessibility support
  const columns = useMemo<Column<User>[]>(() => [
    {
      id: 'fullName',
      label: 'Full Name',
      sortable: true,
      ariaLabel: 'Sort by full name',
      render: (user: User) => (
        <span role="cell" aria-label={`User: ${user.fullName}`}>
          {user.fullName}
        </span>
      )
    },
    {
      id: 'email',
      label: 'Email',
      sortable: true,
      ariaLabel: 'Sort by email address',
      render: (user: User) => (
        <span role="cell" aria-label={`Email: ${user.email}`}>
          {user.email}
        </span>
      )
    },
    {
      id: 'role',
      label: 'Role',
      sortable: true,
      ariaLabel: 'Sort by user role',
      render: (user: User) => (
        <Chip
          label={getRoleLabel(user.role)}
          sx={{
            ...styles['role-chip'],
            ...styles[user.role.toLowerCase()],
          }}
          aria-label={`Role: ${getRoleLabel(user.role)}`}
        />
      )
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      ariaLabel: 'Sort by user status',
      render: (user: User) => (
        <Chip
          label={user.isActive ? 'Active' : 'Inactive'}
          sx={{
            ...styles['status-chip'],
            ...(user.isActive ? styles['active-status'] : styles['inactive-status']),
          }}
          aria-label={`Status: ${user.isActive ? 'Active' : 'Inactive'}`}
        />
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      ariaLabel: 'User actions',
      render: (user: User) => (
        <div role="group" aria-label={`Actions for ${user.fullName}`}>
          <Tooltip title="Edit user" arrow>
            <IconButton
              onClick={() => onEdit(user)}
              sx={styles['action-button']}
              aria-label={`Edit ${user.fullName}`}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete user" arrow>
            <IconButton
              onClick={() => onDelete(user)}
              sx={styles['action-button']}
              color="error"
              aria-label={`Delete ${user.fullName}`}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </div>
      )
    }
  ], [onEdit, onDelete]);

  return (
    <DataTable<User>
      data={users}
      columns={columns}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      loading={loading}
      ariaLabel={ariaLabel}
      ariaLabelledBy="user-table-title"
      getRowAriaLabel={(user) => `User row: ${user.fullName}`}
      enableVirtualization
      virtualRowHeight={52}
    />
  );
});

// Styles following design system specifications with accessibility considerations
const styles = {
  'role-chip': {
    margin: '0 8px',
    fontWeight: 500,
    minWidth: '44px',
    height: '32px',
  },
  'status-chip': {
    margin: '0 8px',
    minWidth: '44px',
    height: '32px',
  },
  'action-button': {
    padding: '8px',
    minWidth: '44px',
    minHeight: '44px',
  },
  'system_admin': {
    backgroundColor: '#1976d2',
    color: 'white',
  },
  'client_admin': {
    backgroundColor: '#2e7d32',
    color: 'white',
  },
  'regular_user': {
    backgroundColor: '#ed6c02',
    color: 'white',
  },
  'api_service': {
    backgroundColor: '#9c27b0',
    color: 'white',
  },
  'active-status': {
    backgroundColor: '#4caf50',
    color: 'white',
  },
  'inactive-status': {
    backgroundColor: '#d32f2f',
    color: 'white',
  },
} as const;

// Display name for debugging
UserTable.displayName = 'UserTable';

export default UserTable;