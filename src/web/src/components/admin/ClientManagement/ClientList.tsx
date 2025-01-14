import React, { useState, useCallback, useEffect } from 'react';
import { Box, Button, Typography, Alert, Snackbar } from '@mui/material'; // v5.14.0
import { Add as AddIcon } from '@mui/icons-material'; // v5.14.0
import { useDebounce } from 'use-debounce'; // v9.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import ClientTable from './ClientTable';
import ClientForm from './ClientForm';
import SearchField from '../../common/Forms/SearchField';
import { useAuth } from '../../../hooks/useAuth';
import type { Client, ClientStatus } from '../../../types/client';
import type { PaginationParams } from '../../../types/common';

// Enhanced state interface with loading and error states
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

// Error fallback component for error boundary
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Box role="alert" sx={styles.errorContainer}>
    <Typography variant="h6" color="error">Error Loading Clients</Typography>
    <Typography color="error">{error.message}</Typography>
    <Button onClick={resetErrorBoundary} variant="contained" sx={{ mt: 2 }}>
      Try Again
    </Button>
  </Box>
);

const ClientList: React.FC = React.memo(() => {
  // Initialize state with proper type safety
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

  const { user } = useAuth();

  // Debounced search query for performance
  const [debouncedQuery] = useDebounce(state.searchQuery, 300);

  // Fetch clients with abort controller for cleanup
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
    setState(prev => ({ ...prev, loading: true, abortController: controller }));

    try {
      const response = await fetch(
        `/api/clients?page=${page}&pageSize=${pageSize}${search ? `&search=${search}` : ''}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
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
        loading: false,
        error: null
      }));
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error
        }));
      }
    }
  }, []);

  // Handle pagination changes with optimistic updates
  const handlePageChange = useCallback(({ page, pageSize }: PaginationParams) => {
    setState(prev => ({ ...prev, page, pageSize }));
    fetchClients(page, pageSize, state.searchQuery);
  }, [fetchClients, state.searchQuery]);

  // Handle search with debounce
  const handleSearch = useCallback((value: string) => {
    setState(prev => ({ ...prev, searchQuery: value, page: 1 }));
  }, []);

  // Handle client deletion with optimistic updates
  const handleDelete = useCallback(async (client: Client) => {
    setState(prev => ({ ...prev, deleting: true }));

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
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
        error: error as Error,
        deleting: false
      }));
    }
  }, []);

  // Handle form open/close
  const handleFormOpen = useCallback((client?: Client) => {
    setState(prev => ({
      ...prev,
      formOpen: true,
      selectedClient: client
    }));
  }, []);

  const handleFormClose = useCallback(() => {
    setState(prev => ({
      ...prev,
      formOpen: false,
      selectedClient: undefined
    }));
  }, []);

  // Effect for initial load and search updates
  useEffect(() => {
    fetchClients(state.page, state.pageSize, debouncedQuery);

    return () => {
      if (state.abortController) {
        state.abortController.abort();
      }
    };
  }, [fetchClients, state.page, state.pageSize, debouncedQuery]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box sx={styles.container}>
        {/* Header section */}
        <Box sx={styles.header}>
          <Typography variant="h5" component="h1">
            Client Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleFormOpen()}
            disabled={state.loading}
            aria-label="Add new client"
          >
            Add Client
          </Button>
        </Box>

        {/* Search section */}
        <Box sx={styles.searchContainer}>
          <SearchField
            value={state.searchQuery}
            onSearch={handleSearch}
            placeholder="Search clients..."
            isLoading={state.loading}
            fullWidth
          />
        </Box>

        {/* Client table */}
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
          onSettings={(client: Client) => {
            // Handle settings navigation
            console.log('Navigate to settings for client:', client.id);
          }}
        />

        {/* Client form modal */}
        {state.formOpen && (
          <ClientForm
            initialData={state.selectedClient}
            onSuccess={() => {
              handleFormClose();
              fetchClients(state.page, state.pageSize, state.searchQuery);
            }}
            onCancel={handleFormClose}
            isSubmitting={state.loading}
            csrfToken="your-csrf-token" // Should be provided by your auth system
          />
        )}

        {/* Error snackbar */}
        <Snackbar
          open={!!state.error}
          autoHideDuration={6000}
          onClose={() => setState(prev => ({ ...prev, error: null }))}
        >
          <Alert severity="error" variant="filled">
            {state.error?.message}
          </Alert>
        </Snackbar>
      </Box>
    </ErrorBoundary>
  );
});

// Styles following design system specifications
const styles = {
  container: {
    padding: 3,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 3
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 2
  },
  searchContainer: {
    width: '100%',
    maxWidth: 600,
    mb: 3
  },
  errorContainer: {
    p: 3,
    textAlign: 'center',
    border: '1px solid',
    borderColor: 'error.main',
    borderRadius: 1,
    bgcolor: 'error.light',
    color: 'error.dark'
  }
} as const;

// Display name for debugging
ClientList.displayName = 'ClientList';

export default ClientList;