import React from 'react';
import DataTable, { Column, TableProps } from '../../common/Tables/DataTable';
import { User, UserRole } from '../../../types/user';
import { Chip, IconButton, Tooltip } from '@mui/material'; // v5.14.0
import { Edit, Delete } from '@mui/icons-material'; // v5.14.0

interface UserTableProps {
  users: User[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: TableProps<User>['onPageChange'];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  loading?: boolean;
  ariaLabel?: string;
  ariaDescription?: string;
}

const getRoleLabel = (role: UserRole): string => {
  switch (role) {
    case UserRole.SYSTEM_ADMIN:
      return 'System Administrator';
    case UserRole.CLIENT_ADMIN:
      return 'Client Administrator';
    case UserRole.REGULAR_USER:
      return 'Regular User';
    default:
      return 'Unknown Role';
  }
};

const getRoleChipColor = (role: UserRole): { bg: string; text: string } => {
  switch (role) {
    case UserRole.SYSTEM_ADMIN:
      return { bg: '#1976d2', text: '#ffffff' }; // WCAG AA compliant - 4.5:1
    case UserRole.CLIENT_ADMIN:
      return { bg: '#2e7d32', text: '#ffffff' }; // WCAG AA compliant - 4.5:1
    case UserRole.REGULAR_USER:
      return { bg: '#ed6c02', text: '#ffffff' }; // WCAG AA compliant - 4.5:1
    default:
      return { bg: '#757575', text: '#ffffff' }; // WCAG AA compliant - 4.5:1
  }
};

const UserTable: React.FC<UserTableProps> = React.memo(({
  users,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onDelete,
  loading = false,
  ariaLabel = 'User management table',
  ariaDescription = 'Table displaying user information with sorting and filtering capabilities'
}) => {
  const columns: Column<User>[] = React.useMemo(() => [
    {
      id: 'fullName',
      label: 'Full Name',
      sortable: true,
      ariaLabel: 'Sort by full name',
      render: (user: User) => (
        <span role="cell">{user.fullName}</span>
      )
    },
    {
      id: 'email',
      label: 'Email',
      sortable: true,
      ariaLabel: 'Sort by email address',
      render: (user: User) => (
        <span role="cell">{user.email}</span>
      )
    },
    {
      id: 'role',
      label: 'Role',
      sortable: true,
      ariaLabel: 'Sort by user role',
      render: (user: User) => {
        const { bg, text } = getRoleChipColor(user.role);
        return (
          <Chip
            label={getRoleLabel(user.role)}
            sx={{
              backgroundColor: bg,
              color: text,
              margin: '0 8px',
              fontWeight: 500,
              minWidth: '44px',
              height: '32px'
            }}
            role="cell"
            aria-label={`Role: ${getRoleLabel(user.role)}`}
          />
        );
      }
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
            backgroundColor: user.isActive ? '#4caf50' : '#d32f2f',
            color: '#ffffff',
            margin: '0 8px',
            minWidth: '44px',
            height: '32px'
          }}
          role="cell"
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
        <div role="cell" style={{ whiteSpace: 'nowrap' }}>
          <Tooltip title="Edit user" arrow>
            <IconButton
              onClick={() => onEdit(user)}
              aria-label={`Edit user ${user.fullName}`}
              sx={{
                padding: '8px',
                minWidth: '44px',
                minHeight: '44px'
              }}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete user" arrow>
            <IconButton
              onClick={() => onDelete(user)}
              aria-label={`Delete user ${user.fullName}`}
              sx={{
                padding: '8px',
                minWidth: '44px',
                minHeight: '44px'
              }}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </div>
      )
    }
  ], [onEdit, onDelete]);

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-description={ariaDescription}
      style={{ position: 'relative', minHeight: '400px' }}
    >
      <DataTable<User>
        data={users}
        columns={columns}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        loading={loading}
        ariaLabel={ariaLabel}
        getRowAriaLabel={(user) => `User: ${user.fullName}, Role: ${getRoleLabel(user.role)}, Status: ${user.isActive ? 'Active' : 'Inactive'}`}
        enableVirtualization
        virtualRowHeight={52}
      />
    </div>
  );
});

UserTable.displayName = 'UserTable';

export default UserTable;