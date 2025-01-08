import React, { useState, useCallback, useEffect } from 'react';
import { Box, Button, Typography, Alert, useTheme } from '@mui/material'; // v5.14.0
import { Add as AddIcon } from '@mui/icons-material'; // v5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import ClientTable from './ClientTable';
import ClientForm from './ClientForm';
import SearchField from '../../common/Forms/SearchField';
import { useAuth } from '../../../hooks/useAuth';
import { Client, ClientStatus } from '../../../types/client';
import { UserRole } from '../../../types/auth';

// Enhanced state interface with comprehensive error handling
interface ClientListState {
  clients: Client[];
  total: number;
  page: number;
  pageSize: number;
  searchQuery: string;
  loading: boolean;
  deleting: boolean;
  formOpen: boolean;
  selectedClient: Client | undefined;
  error: Error | null;
  abortController: AbortController | null;
}

// Error fallback component with accessibility support
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Alert 
    severity="error" 
    onClose={resetErrorBoundary}
    sx={{ margin: 2 }}
  >
    <Typography variant="h6">Error loading clients</Typography>
    <Typography>{error.message}</Typography>
    <Button onClick={resetErrorBoundary} sx={{ mt: 1 }}>
      Try Again
    </Button>
  </Alert>
);

const ClientList: React.FC = React.memo(() => {
  const theme = useTheme();
  const { user } = useAuth();
  
  // Initialize state with proper type safety
  const [state, setState] = useState<ClientListState>({
    clients: [],
    total: 0,
    page: 1,
    pageSize: 10,
    searchQuery: '',
    loading: true,
    deleting: false,
    formOpen: false,
    selectedClient: undefined,
    error: null,
    abortController: null
  });

  // Fetch clients with proper error handling and cleanup
  const fetchClients = useCallback(async (
    page: number,
    pageSize: number,
    searchQuery: string,
    signal?: AbortSignal
  ) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch(
        `/api/clients?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          signal
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        clients: data.items,
        total: data.total,
        loading: false
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

  // Handle pagination with optimistic updates
  const handlePageChange = useCallback(({ page, pageSize }) => {
    setState(prev => ({ ...prev, page, pageSize }));
    fetchClients(page, pageSize, state.searchQuery);
  }, [fetchClients, state.searchQuery]);

  // Handle search with debouncing
  const handleSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query, page: 1 }));
    fetchClients(1, state.pageSize, query);
  }, [fetchClients, state.pageSize]);

  // Handle client deletion with optimistic updates
  const handleDelete = useCallback(async (client: Client) => {
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

  // Handle form open/close with proper state cleanup
  const handleFormOpen = useCallback((client?: Client) => {
    setState(prev => ({
      ...prev,
      formOpen: true,
      selectedClient: client,
      error: null
    }));
  }, []);

  const handleFormClose = useCallback(() => {
    setState(prev => ({
      ...prev,
      formOpen: false,
      selectedClient: undefined,
      error: null
    }));
  }, []);

  // Handle form submission success
  const handleFormSuccess = useCallback(() => {
    handleFormClose();
    fetchClients(state.page, state.pageSize, state.searchQuery);
  }, [fetchClients, handleFormClose, state.page, state.pageSize, state.searchQuery]);

  // Set up initial data fetch with cleanup
  useEffect(() => {
    const controller = new AbortController();
    setState(prev => ({ ...prev, abortController: controller }));
    
    fetchClients(state.page, state.pageSize, state.searchQuery, controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchClients, state.page, state.pageSize, state.searchQuery]);

  // Check user permissions
  if (!user || user.role !== UserRole.SYSTEM_ADMIN) {
    return (
      <Alert severity="error" sx={{ margin: 2 }}>
        You do not have permission to access this page.
      </Alert>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box sx={{ padding: theme.spacing(3) }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing(3)
        }}>
          <Typography variant="h5" component="h1">
            Client Management
          </Typography>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleFormOpen()}
            disabled={state.loading || state.deleting}
          >
            Add New Client
          </Button>
        </Box>

        <Box sx={{ marginBottom: theme.spacing(3) }}>
          <SearchField
            value={state.searchQuery}
            onSearch={handleSearch}
            placeholder="Search clients..."
            isLoading={state.loading}
            debounceMs={300}
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
          onEdit={handleFormOpen}
          onDelete={handleDelete}
          onSettings={(client) => console.log('Settings:', client.id)}
        />

        {state.formOpen && (
          <ClientForm
            initialData={state.selectedClient}
            onSuccess={handleFormSuccess}
            onCancel={handleFormClose}
            isSubmitting={state.loading}
            csrfToken="your-csrf-token-here"
          />
        )}
      </Box>
    </ErrorBoundary>
  );
});

ClientList.displayName = 'ClientList';

export default ClientList;