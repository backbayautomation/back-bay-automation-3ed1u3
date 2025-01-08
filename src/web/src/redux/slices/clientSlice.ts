/**
 * Redux Toolkit slice for managing client-related state in the frontend application.
 * Implements comprehensive client data management with optimistic updates and enhanced error handling.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import { Client, ClientId, ClientStatus } from '../../types/client';
import type { RootState } from '../store';
import type { PaginationParams } from '../../types/common';

// Enhanced error interface for detailed error tracking
interface ClientError {
  message: string;
  code: string;
  details?: any;
}

// Enhanced interface for client slice state
interface ClientState {
  clients: Client[];
  selectedClient: Client | null;
  selectedClientId: ClientId | null;
  loading: {
    fetchClients: boolean;
    updateClient: boolean;
    deleteClient: boolean;
  };
  error: ClientError | null;
  totalClients: number;
  lastUpdated: Date | null;
  searchQuery: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  pendingOperations: Record<ClientId, boolean>;
}

// Initial state with comprehensive tracking fields
const initialState: ClientState = {
  clients: [],
  selectedClient: null,
  selectedClientId: null,
  loading: {
    fetchClients: false,
    updateClient: false,
    deleteClient: false,
  },
  error: null,
  totalClients: 0,
  lastUpdated: null,
  searchQuery: '',
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
  },
  pendingOperations: {},
};

// Enhanced async thunk for fetching clients with pagination and search
export const fetchClients = createAsyncThunk<
  { clients: Client[]; total: number },
  PaginationParams,
  { rejectValue: ClientError }
>(
  'clients/fetchClients',
  async (params, { rejectWithValue, signal }) => {
    try {
      // API call would go here
      const response = await fetch(`/api/clients?page=${params.page}&limit=${params.pageSize}`, {
        signal,
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      return { clients: data.items, total: data.total };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to fetch clients',
        code: 'FETCH_ERROR',
        details: error,
      });
    }
  }
);

// Enhanced async thunk for updating client with optimistic updates
export const updateClient = createAsyncThunk<
  Client,
  Partial<Client> & { id: ClientId },
  { state: RootState; rejectValue: ClientError }
>(
  'clients/updateClient',
  async (clientData, { getState, rejectWithValue }) => {
    try {
      // API call would go here
      const response = await fetch(`/api/clients/${clientData.id}`, {
        method: 'PATCH',
        body: JSON.stringify(clientData),
      });

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      return await response.json();
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to update client',
        code: 'UPDATE_ERROR',
        details: error,
      });
    }
  }
);

// Client slice with comprehensive state management
export const clientSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    setSelectedClient: (state, action: PayloadAction<ClientId | null>) => {
      state.selectedClientId = action.payload;
      state.selectedClient = state.clients.find(client => client.id === action.payload) || null;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.pagination.page = 1; // Reset pagination on new search
    },
    clearError: (state) => {
      state.error = null;
    },
    resetClientState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch clients reducers
      .addCase(fetchClients.pending, (state) => {
        state.loading.fetchClients = true;
        state.error = null;
      })
      .addCase(fetchClients.fulfilled, (state, action) => {
        state.loading.fetchClients = false;
        state.clients = action.payload.clients;
        state.totalClients = action.payload.total;
        state.lastUpdated = new Date();
        state.error = null;
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.loading.fetchClients = false;
        state.error = action.payload || {
          message: 'An unknown error occurred',
          code: 'UNKNOWN_ERROR',
        };
      })
      // Update client reducers with optimistic updates
      .addCase(updateClient.pending, (state, action) => {
        state.loading.updateClient = true;
        state.pendingOperations[action.meta.arg.id] = true;
      })
      .addCase(updateClient.fulfilled, (state, action) => {
        state.loading.updateClient = false;
        state.clients = state.clients.map(client =>
          client.id === action.payload.id ? action.payload : client
        );
        delete state.pendingOperations[action.payload.id];
        if (state.selectedClientId === action.payload.id) {
          state.selectedClient = action.payload;
        }
      })
      .addCase(updateClient.rejected, (state, action) => {
        state.loading.updateClient = false;
        state.error = action.payload || {
          message: 'An unknown error occurred',
          code: 'UNKNOWN_ERROR',
        };
        delete state.pendingOperations[action.meta.arg.id];
      });
  },
});

// Export actions
export const {
  setSelectedClient,
  setSearchQuery,
  clearError,
  resetClientState,
} = clientSlice.actions;

// Memoized selectors for optimized state access
export const selectClients = (state: RootState) => state.clients.clients;
export const selectSelectedClient = (state: RootState) => state.clients.selectedClient;
export const selectClientLoadingStates = (state: RootState) => state.clients.loading;
export const selectClientError = (state: RootState) => state.clients.error;
export const selectClientPagination = (state: RootState) => state.clients.pagination;

// Memoized selector for filtered and derived client data
export const selectFilteredClients = createSelector(
  [selectClients, (state: RootState) => state.clients.searchQuery],
  (clients, searchQuery) => {
    if (!searchQuery) return clients;
    return clients.filter(client =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
);

// Memoized selector for active clients count
export const selectActiveClientsCount = createSelector(
  [selectClients],
  (clients) => clients.filter(client => client.status === ClientStatus.ACTIVE).length
);

// Export reducer
export default clientSlice.reducer;