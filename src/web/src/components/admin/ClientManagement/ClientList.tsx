import React, { useState, useCallback, useEffect } from 'react';
import { Box, Button, Typography, useTheme } from '@mui/material'; // v5.14.0
import { Add as AddIcon } from '@mui/icons-material'; // v5.14.0
import { useDebounce } from 'use-debounce'; // v9.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import ClientTable, { ClientTableProps } from './ClientTable';
import ClientForm from './ClientForm';
import SearchField from '../../common/Forms/SearchField';
import { Client, ClientStatus } from '../../../types/client';
import { useAuth } from '../../../hooks/useAuth';
import { UserRole } from '../../../types/auth';

interface ClientListState {
  loading: boolean;
  deleting: boolean;
  clients: Client[];
  total: number;
  page: number;
  pageSize: number;
  searchQuery: string;
  formOpen: boolean;
  selectedClient: Client | undefined;
  error: Error | null;
  abortController: AbortController | null;
}

const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Box
    role="alert"
    sx={{
      p: 3,
      color: 'error.main',
      textAlign: 'center'
    }}
  >
    <Typography variant="h6" gutterBottom>
      Error loading clients:
    </Typography>
    <Typography variant="body1" gutterBottom>
      {error.message}
    </Typography>
    <Button onClick={resetErrorBoundary} variant="contained" color="primary">
      Try Again
    </Button>
  </Box>
);

const ClientList: React.FC = React.memo(() => {
  const theme = useTheme();
  const { user } = useAuth();
  const [state, setState] = useState<ClientListState>({
    loading: true,
    deleting: false,
    clients: [],
    total: 0,
    page: 1,
    pageSize: 10,
    searchQuery: '',
    formOpen: false,
    selectedClient: undefined,
    error: null,
    abortController: null
  });

  const [debouncedSearch] = useDebounce(state.searchQuery, 300);

  const fetchClients = useCallback(async (
    page: number,
    pageSize: number,
    search?: string
  ) => {
    // Cancel previous request if exists
    if (state.abortController) {
      state.abortController.abort();
    }

    const controller = new AbortController();
    setState(prev => ({ ...prev, loading: true, error: null, abortController: controller }));

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search })
      });

      const response = await fetch(`/api/clients?${queryParams}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        clients: data.items,
        total: data.total,
        loading: false,
        error: null
      }));
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch clients')
      }));
    }
  }, []);

  useEffect(() => {
    fetchClients(state.page, state.pageSize, debouncedSearch);
    return () => {
      if (state.abortController) {
        state.abortController.abort();
      }
    };
  }, [state.page, state.pageSize, debouncedSearch, fetchClients]);

  const handlePageChange = useCallback(({ page, pageSize }) => {
    setState(prev => ({ ...prev, page, pageSize }));
  }, []);

  const handleSearch = useCallback((value: string) => {
    setState(prev => ({ ...prev, searchQuery: value, page: 1 }));
  }, []);

  const handleAddClient = useCallback(() => {
    setState(prev => ({ ...prev, formOpen: true, selectedClient: undefined }));
  }, []);

  const handleEditClient = useCallback(async (client: Client) => {
    setState(prev => ({ ...prev, formOpen: true, selectedClient: client }));
  }, []);

  const handleDeleteClient = useCallback(async (client: Client) => {
    if (!window.confirm(`Are you sure you want to delete ${client.name}?`)) {
      return;
    }

    setState(prev => ({ ...prev, deleting: true }));

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete client');
      }

      // Optimistic update
      setState(prev => ({
        ...prev,
        clients: prev.clients.filter(c => c.id !== client.id),
        total: prev.total - 1,
        deleting: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        deleting: false,
        error: error instanceof Error ? error : new Error('Failed to delete client')
      }));
    }
  }, []);

  const handleFormClose = useCallback(() => {
    setState(prev => ({ ...prev, formOpen: false, selectedClient: undefined }));
  }, []);

  const handleFormSuccess = useCallback(() => {
    setState(prev => ({ ...prev, formOpen: false, selectedClient: undefined }));
    fetchClients(state.page, state.pageSize, state.searchQuery);
  }, [state.page, state.pageSize, state.searchQuery, fetchClients]);

  if (!user || user.role !== UserRole.SYSTEM_ADMIN) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">
          Unauthorized access. System admin privileges required.
        </Typography>
      </Box>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" component="h1">
            Client Management
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddClient}
            disabled={state.loading || state.deleting}
          >
            Add New Client
          </Button>
        </Box>

        <Box sx={{ mb: 3 }}>
          <SearchField
            value={state.searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onClear={() => handleSearch('')}
            placeholder="Search clients..."
            isLoading={state.loading}
            fullWidth
          />
        </Box>

        <ClientTable
          clients={state.clients}
          page={state.page}
          pageSize={state.pageSize}
          total={state.total}
          loading={state.loading}
          error={state.error}
          onPageChange={handlePageChange}
          onEdit={handleEditClient}
          onDelete={handleDeleteClient}
          onSettings={handleEditClient}
        />

        {state.formOpen && (
          <ClientForm
            initialData={state.selectedClient}
            onSuccess={handleFormSuccess}
            onCancel={handleFormClose}
            isSubmitting={state.loading}
            csrfToken={document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || ''}
          />
        )}
      </Box>
    </ErrorBoundary>
  );
});

ClientList.displayName = 'ClientList';

export default ClientList;