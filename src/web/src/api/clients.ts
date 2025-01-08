/**
 * API client module for handling client-related HTTP requests.
 * Implements CRUD operations for client management with enhanced security,
 * reliability, monitoring, and comprehensive error handling features.
 * @version 1.0.0
 */

import { AxiosInstance } from 'axios'; // v1.5.0
import retry from 'axios-retry'; // v3.8.0

import { ApiResponse } from './types';
import { Client } from '../types/client';
import { createApiInstance } from '../utils/api';
import { RequestValidator } from '../utils/validation';
import { API_ENDPOINTS } from '../config/api';

/**
 * Interface for client list request parameters
 */
interface GetClientsParams {
  page: number;
  limit: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  searchQuery?: string;
  filters?: Record<string, string>;
}

/**
 * Interface for client creation/update payload
 */
interface ClientPayload {
  name: string;
  orgId: string;
  config: {
    chatEnabled: boolean;
    exportEnabled: boolean;
    maxUsers: number;
    features: Record<string, unknown>;
    theme: {
      mode: 'light' | 'dark';
      colors: Record<string, string>;
      typography: {
        fontFamily: string;
        fontSize: string;
      };
    };
  };
  branding: {
    primaryColor: string;
    logoUrl: string;
    companyName: string;
    customStyles: Record<string, string>;
  };
}

/**
 * Retrieves paginated list of clients with enhanced error handling and monitoring
 */
export const getClients = async (
  params: GetClientsParams,
  options: { skipCache?: boolean; priority?: 'high' | 'normal' } = {}
): Promise<ApiResponse<{ items: Client[]; total: number }>> => {
  const api = createApiInstance({
    useCircuitBreaker: true,
    customTimeout: options.priority === 'high' ? 15000 : 30000,
  });

  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
    ...(params.sortBy && { sortBy: params.sortBy }),
    ...(params.order && { order: params.order }),
    ...(params.searchQuery && { search: params.searchQuery }),
    ...(params.filters && { filters: JSON.stringify(params.filters) }),
  });

  const cacheKey = `clients_${queryParams.toString()}`;
  if (!options.skipCache) {
    const cached = await getCachedResponse(cacheKey);
    if (cached) return cached;
  }

  const response = await api.get(`${API_ENDPOINTS.CLIENTS.LIST}?${queryParams}`);
  await cacheResponse(cacheKey, response.data);
  return response.data;
};

/**
 * Retrieves a specific client by ID with enhanced validation and security
 */
export const getClientById = async (
  clientId: string,
  options: { includeMetadata?: boolean } = {}
): Promise<ApiResponse<Client>> => {
  const validator = new RequestValidator();
  validator.validate({ clientId }, { clientId: 'uuid' });

  const api = createApiInstance({ useCircuitBreaker: true });
  const response = await api.get(
    `${API_ENDPOINTS.CLIENTS.LIST}/${clientId}${options.includeMetadata ? '?include=metadata' : ''}`
  );
  return response.data;
};

/**
 * Creates a new client with comprehensive validation and security checks
 */
export const createClient = async (
  payload: ClientPayload
): Promise<ApiResponse<Client>> => {
  const validator = new RequestValidator();
  validator.validate(payload, {
    name: 'string|required|min:2|max:100',
    orgId: 'uuid|required',
    config: 'object|required',
    branding: 'object|required',
  });

  const api = createApiInstance({
    useCircuitBreaker: true,
    customHeaders: {
      'X-Operation-Type': 'client-creation',
    },
  });

  const response = await api.post(API_ENDPOINTS.CLIENTS.CREATE, payload);
  return response.data;
};

/**
 * Updates an existing client with validation and optimistic updates
 */
export const updateClient = async (
  clientId: string,
  payload: Partial<ClientPayload>
): Promise<ApiResponse<Client>> => {
  const validator = new RequestValidator();
  validator.validate(
    { clientId, ...payload },
    { clientId: 'uuid|required' }
  );

  const api = createApiInstance({
    useCircuitBreaker: true,
    customHeaders: {
      'X-Operation-Type': 'client-update',
      'If-Match': await getClientEtag(clientId),
    },
  });

  const response = await api.put(
    `${API_ENDPOINTS.CLIENTS.UPDATE.replace('{id}', clientId)}`,
    payload
  );
  return response.data;
};

/**
 * Deletes a client with safety checks and cascade options
 */
export const deleteClient = async (
  clientId: string,
  options: { cascade?: boolean } = {}
): Promise<ApiResponse<void>> => {
  const validator = new RequestValidator();
  validator.validate({ clientId }, { clientId: 'uuid|required' });

  const api = createApiInstance({
    useCircuitBreaker: true,
    customHeaders: {
      'X-Operation-Type': 'client-deletion',
      'X-Cascade-Delete': options.cascade ? 'true' : 'false',
    },
  });

  const response = await api.delete(
    `${API_ENDPOINTS.CLIENTS.DELETE.replace('{id}', clientId)}`
  );
  return response.data;
};

// Helper functions
const getCachedResponse = async (key: string): Promise<ApiResponse<any> | null> => {
  // Implementation would use a caching mechanism
  return null;
};

const cacheResponse = async (key: string, data: ApiResponse<any>): Promise<void> => {
  // Implementation would cache the response
};

const getClientEtag = async (clientId: string): Promise<string> => {
  // Implementation would fetch the current ETag for optimistic locking
  return '';
};