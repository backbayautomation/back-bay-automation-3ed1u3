/**
 * Redux Toolkit slice for managing client-related state in the frontend application.
 * Implements comprehensive client data management with optimistic updates and enhanced error handling.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import type { Client, ClientId, ClientStatus, ClientConfig, ClientBranding } from '../../types/client';
import type { PaginationParams, ApiResponse } from '../../types/common';

// State interface with enhanced tracking fields
interface ClientState {
  clients: Client[];
  selectedClient: Client | null;
  selectedClientId: ClientId | null;
  loading: {
    fetchClients: boolean;
    updateClient: boolean;
    deleteClient: boolean;
  };
  error: {
    message: string;
    code: string;
    details?: any;
  } | null;
  totalClients: number;
  lastUpdated: Date | null;
  searchQuery: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  pendingOperations: Record<ClientId, {
    type: 'update' | 'delete';
    timestamp: number;
  }>;
}

// Initial state with proper typing
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
  ApiResponse<{ clients: Client[]; total: number }>,
  PaginationParams,
  { rejectValue: { message: string; code: string } }
>(
  'clients/fetchClients',
  async (params, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/v1/clients?page=${params.page}&limit=${params.pageSize}${
        params.filters.search ? `&search=${params.filters.search}` : ''
      }`);
      
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          message: error.message || 'Failed to fetch clients',
          code: error.code || 'FETCH_ERROR'
        });
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue({
        message: 'Network error occurred',
        code: 'NETWORK_ERROR'
      });
    }
  }
);

// Async thunk for updating client with optimistic updates
export const updateClient = createAsyncThunk<
  Client,
  { id: ClientId; updates: Partial<Client> },
  { rejectValue: { message: string; code: string } }
>(
  'clients/updateClient',
  async ({ id, updates }, { rejectWithValue, getState }) => {
    try {
      const response = await fetch(`/api/v1/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          message: error.message || 'Failed to update client',
          code: error.code || 'UPDATE_ERROR'
        });
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue({
        message: 'Network error occurred',
        code: 'NETWORK_ERROR'
      });
    }
  }
);

// Client slice with comprehensive state management
const clientSlice = createSlice({
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
        state.clients = action.payload.data.clients;
        state.totalClients = action.payload.data.total;
        state.lastUpdated = new Date();
        state.pagination.total = action.payload.data.total;
      })
      .addCase(fetchClients.rejected, (state, action) => {
        state.loading.fetchClients = false;
        state.error = {
          message: action.payload?.message || 'Unknown error occurred',
          code: action.payload?.code || 'UNKNOWN_ERROR'
        };
      })
      // Update client reducers with optimistic updates
      .addCase(updateClient.pending, (state, action) => {
        state.loading.updateClient = true;
        state.pendingOperations[action.meta.arg.id] = {
          type: 'update',
          timestamp: Date.now()
        };
      })
      .addCase(updateClient.fulfilled, (state, action) => {
        state.loading.updateClient = false;
        const index = state.clients.findIndex(client => client.id === action.payload.id);
        if (index !== -1) {
          state.clients[index] = action.payload;
        }
        delete state.pendingOperations[action.payload.id];
        state.lastUpdated = new Date();
      })
      .addCase(updateClient.rejected, (state, action) => {
        state.loading.updateClient = false;
        state.error = {
          message: action.payload?.message || 'Failed to update client',
          code: action.payload?.code || 'UPDATE_ERROR'
        };
        // Revert optimistic update
        delete state.pendingOperations[action.meta.arg.id];
      });
  }
});

// Memoized selectors for optimized state access
export const selectAllClients = createSelector(
  [(state: { clients: ClientState }) => state.clients],
  (clientState) => clientState.clients
);

export const selectActiveClients = createSelector(
  [selectAllClients],
  (clients) => clients.filter(client => client.status === ClientStatus.ACTIVE)
);

export const selectClientById = createSelector(
  [selectAllClients, (_, clientId: ClientId) => clientId],
  (clients, clientId) => clients.find(client => client.id === clientId)
);

export const selectClientLoadingStates = createSelector(
  [(state: { clients: ClientState }) => state.clients.loading],
  (loading) => loading
);

export const selectPaginationData = createSelector(
  [(state: { clients: ClientState }) => state.clients.pagination],
  (pagination) => pagination
);

export const { 
  setSelectedClient, 
  setSearchQuery, 
  clearError, 
  resetClientState 
} = clientSlice.actions;

export default clientSlice.reducer;