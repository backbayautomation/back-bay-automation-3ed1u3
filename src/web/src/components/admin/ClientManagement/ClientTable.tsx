import React, { useMemo, useCallback } from 'react';
import { Edit, Delete, Settings } from '@mui/icons-material'; // v5.14.0
import { Tooltip, Chip, Skeleton } from '@mui/material'; // v5.14.0
import DataTable, { Column } from '../../common/Tables/DataTable';
import IconButton from '../../common/Buttons/IconButton';
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
  const handleAction = useCallback(async (
    action: (client: Client) => Promise<void>,
    client: Client,
    actionName: string
  ) => {
    try {
      await action(client);
    } catch (error) {
      console.error(`Error during ${actionName} action:`, error);
    }
  }, []);

  const columns = useMemo<Column<Client>[]>(() => [
    {
      id: 'name',
      label: 'Client Name',
      sortable: true,
      ariaLabel: 'Sort by client name',
      render: (client: Client) => (
        <span
          className="client-name"
          style={{
            fontWeight: 500,
            color: '#0066CC',
            textDecoration: 'none',
          }}
        >
          {client.name}
        </span>
      ),
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
            fontWeight: 500,
          }}
          aria-label={`Status: ${client.status}`}
        />
      ),
    },
    {
      id: 'documents',
      label: 'Documents',
      sortable: true,
      ariaLabel: 'Sort by document count',
      render: (client: Client) => client.metadata.documentCount || 0,
    },
    {
      id: 'lastActive',
      label: 'Last Active',
      sortable: true,
      ariaLabel: 'Sort by last active date',
      render: (client: Client) => {
        const date = new Date(client.metadata.lastActive as string || '');
        return date.toLocaleDateString() || '-';
      },
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (client: Client) => (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Tooltip title="Edit client">
            <span>
              <IconButton
                color="primary"
                size="medium"
                onClick={() => handleAction(onEdit, client, 'edit')}
                disabled={loading}
                ariaLabel={`Edit ${client.name}`}
                testId={`edit-client-${client.id}`}
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
                onClick={() => handleAction(onSettings, client, 'settings')}
                disabled={loading}
                ariaLabel={`Settings for ${client.name}`}
                testId={`settings-client-${client.id}`}
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
                onClick={() => handleAction(onDelete, client, 'delete')}
                disabled={loading}
                ariaLabel={`Delete ${client.name}`}
                testId={`delete-client-${client.id}`}
              >
                <Delete />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      ),
    },
  ], [handleAction, loading, onDelete, onEdit, onSettings]);

  if (error) {
    return (
      <div
        style={{
          color: '#DC3545',
          padding: '16px',
          textAlign: 'center',
        }}
        role="alert"
        aria-live="polite"
      >
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
            sx={{
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          />
        ))}
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
      enableVirtualization={true}
      virtualRowHeight={52}
      ariaLabel="Client management table"
      getRowAriaLabel={(client) => `Client: ${client.name}`}
      emptyMessage="No clients found"
    />
  );
};

export default React.memo(ClientTable);