import React, { useMemo, useCallback } from 'react';
import { Tooltip, Chip, Skeleton } from '@mui/material'; // v5.14.0
import { Edit, Delete, Settings } from '@mui/icons-material'; // v5.14.0

import DataTable, { Column } from '../../common/Tables/DataTable';
import IconButton from '../../common/Buttons/IconButton';
import { Client, ClientStatus } from '../../../types/client';

// Props interface following the requirements
interface ClientTableProps {
  clients: Client[];
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  error: Error | null;
  onPageChange: (page: number, pageSize: number) => void;
  onEdit: (client: Client) => Promise<void>;
  onDelete: (client: Client) => Promise<void>;
  onSettings: (client: Client) => Promise<void>;
}

// Status color mapping following design system specifications
const getClientStatusColor = (status: ClientStatus): string => {
  switch (status) {
    case ClientStatus.ACTIVE:
      return '#4CAF50'; // success.main
    case ClientStatus.INACTIVE:
      return '#DC3545'; // error.main
    case ClientStatus.PENDING:
      return '#FFC107'; // warning.main
    case ClientStatus.SUSPENDED:
      return '#B71C1C'; // error.dark
    default:
      return '#757575'; // grey.600
  }
};

const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  page,
  pageSize,
  total,
  loading,
  error,
  onPageChange,
  onEdit,
  onDelete,
  onSettings,
}) => {
  // Memoized action handlers for performance
  const handleEdit = useCallback(async (client: Client) => {
    await onEdit(client);
  }, [onEdit]);

  const handleDelete = useCallback(async (client: Client) => {
    await onDelete(client);
  }, [onDelete]);

  const handleSettings = useCallback(async (client: Client) => {
    await onSettings(client);
  }, [onSettings]);

  // Memoized column definitions
  const columns = useMemo<Column<Client>[]>(() => [
    {
      id: 'name',
      label: 'Client Name',
      sortable: true,
      render: (client: Client) => (
        <span className="client-name" sx={styles['client-name']}>
          {client.name}
        </span>
      ),
      ariaLabel: 'Sort by client name'
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (client: Client) => (
        <Chip
          label={client.status}
          sx={{
            ...styles['status-chip'],
            backgroundColor: getClientStatusColor(client.status),
            color: '#FFFFFF'
          }}
        />
      ),
      ariaLabel: 'Sort by status'
    },
    {
      id: 'documents',
      label: 'Documents',
      sortable: true,
      render: (client: Client) => client.metadata.documentCount || 0,
      ariaLabel: 'Sort by document count'
    },
    {
      id: 'lastActive',
      label: 'Last Active',
      sortable: true,
      render: (client: Client) => {
        const date = new Date(client.metadata.lastActive as string);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      },
      ariaLabel: 'Sort by last active date'
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (client: Client) => (
        <div className="action-cell" sx={styles['action-cell']}>
          <Tooltip title="Edit Client">
            <span>
              <IconButton
                color="primary"
                onClick={() => handleEdit(client)}
                ariaLabel="Edit client"
                disabled={loading}
              >
                <Edit />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Client Settings">
            <span>
              <IconButton
                color="info"
                onClick={() => handleSettings(client)}
                ariaLabel="Client settings"
                disabled={loading}
              >
                <Settings />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Delete Client">
            <span>
              <IconButton
                color="error"
                onClick={() => handleDelete(client)}
                ariaLabel="Delete client"
                disabled={loading}
              >
                <Delete />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      )
    }
  ], [loading, handleEdit, handleDelete, handleSettings]);

  // Loading state
  if (loading) {
    return (
      <div>
        {[...Array(5)].map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            sx={styles['loading-skeleton']}
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-message" sx={styles['error-message']}>
        Error loading clients: {error.message}
      </div>
    );
  }

  return (
    <DataTable<Client>
      data={clients}
      columns={columns}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={({ page: newPage, pageSize: newPageSize }) => {
        onPageChange(newPage, newPageSize);
      }}
      loading={loading}
      enableVirtualization
      virtualRowHeight={52}
      ariaLabel="Client management table"
      getRowAriaLabel={(client) => `Client ${client.name}`}
    />
  );
};

// Styles following design system specifications
const styles = {
  'action-cell': {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  'status-chip': {
    minWidth: '80px',
    textAlign: 'center',
    borderRadius: '16px',
    padding: '4px 12px',
    fontWeight: 500
  },
  'client-name': {
    fontWeight: 500,
    color: 'primary.main',
    textDecoration: 'none'
  },
  'loading-skeleton': {
    height: '40px',
    borderRadius: '4px',
    marginBottom: '8px'
  },
  'error-message': {
    color: 'error.main',
    padding: '16px',
    textAlign: 'center'
  }
} as const;

export default React.memo(ClientTable);