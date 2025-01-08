import React, { useMemo, useCallback } from 'react';
import { Tooltip, Chip, Skeleton } from '@mui/material'; // v5.14.0
import { Edit, Delete, Settings } from '@mui/icons-material'; // v5.14.0
import { DataTable, Column } from '../../common/Tables/DataTable';
import { IconButton } from '../../common/Buttons/IconButton';
import { Client, ClientStatus } from '../../../types/client';

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

const getClientStatusColor = (status: ClientStatus): string => {
  switch (status) {
    case ClientStatus.ACTIVE:
      return '#4CAF50';
    case ClientStatus.INACTIVE:
      return '#DC3545';
    case ClientStatus.PENDING:
      return '#FFC107';
    case ClientStatus.SUSPENDED:
      return '#9E1C23';
    default:
      return '#757575';
  }
};

const ClientTable: React.FC<ClientTableProps> = React.memo(({
  clients,
  page,
  pageSize,
  total,
  loading,
  error,
  onPageChange,
  onEdit,
  onDelete,
  onSettings
}) => {
  const handlePageChange = useCallback(({ page: newPage, pageSize: newPageSize }) => {
    onPageChange(newPage, newPageSize);
  }, [onPageChange]);

  const columns = useMemo<Column<Client>[]>(() => [
    {
      id: 'name',
      label: 'Client Name',
      sortable: true,
      ariaLabel: 'Sort by client name',
      render: (client: Client) => (
        <span className="client-name" style={{ fontWeight: 500, color: '#0066CC' }}>
          {client.name}
        </span>
      ),
      headerClassName: 'client-name-header'
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      ariaLabel: 'Sort by status',
      render: (client: Client) => (
        <Chip
          label={client.status}
          sx={{
            backgroundColor: getClientStatusColor(client.status),
            color: '#FFFFFF',
            minWidth: '80px',
            textAlign: 'center',
            borderRadius: '16px',
            padding: '4px 12px',
            fontWeight: 500
          }}
          aria-label={`Status: ${client.status}`}
        />
      )
    },
    {
      id: 'maxUsers',
      label: 'Users',
      sortable: true,
      ariaLabel: 'Sort by maximum users',
      render: (client: Client) => client.config.maxUsers.toString()
    },
    {
      id: 'lastActive',
      label: 'Last Active',
      sortable: true,
      ariaLabel: 'Sort by last active date',
      render: (client: Client) => {
        const date = new Date(client.updatedAt);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (client: Client) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Tooltip title="Edit client">
            <span>
              <IconButton
                color="primary"
                size="medium"
                onClick={() => onEdit(client)}
                ariaLabel={`Edit ${client.name}`}
                disabled={loading}
              >
                <Edit />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Client settings">
            <span>
              <IconButton
                color="info"
                size="medium"
                onClick={() => onSettings(client)}
                ariaLabel={`Settings for ${client.name}`}
                disabled={loading}
              >
                <Settings />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Delete client">
            <span>
              <IconButton
                color="error"
                size="medium"
                onClick={() => onDelete(client)}
                ariaLabel={`Delete ${client.name}`}
                disabled={loading || client.status === ClientStatus.ACTIVE}
              >
                <Delete />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      )
    }
  ], [loading, onEdit, onDelete, onSettings]);

  if (error) {
    return (
      <div role="alert" style={{ color: '#DC3545', padding: '16px', textAlign: 'center' }}>
        Error loading clients: {error.message}
      </div>
    );
  }

  if (loading && !clients.length) {
    return (
      <div>
        {[...Array(5)].map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={40}
            sx={{ marginBottom: 1, borderRadius: '4px' }}
            aria-label="Loading client data"
          />
        ))}
      </div>
    );
  }

  return (
    <DataTable
      data={clients}
      columns={columns}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={handlePageChange}
      loading={loading}
      emptyMessage="No clients found"
      enableVirtualization={clients.length > 100}
      virtualRowHeight={52}
      ariaLabel="Clients table"
      getRowAriaLabel={(client) => `Client: ${client.name}`}
    />
  );
});

ClientTable.displayName = 'ClientTable';

export default ClientTable;