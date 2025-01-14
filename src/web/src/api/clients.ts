/**
 * API client module for handling client-related HTTP requests in the frontend application.
 * Implements CRUD operations for client management with enhanced security, reliability,
 * monitoring, and comprehensive error handling features.
 * @version 1.0.0
 */

import { AxiosInstance } from 'axios'; // v1.5.0
import { retry } from 'axios-retry'; // v3.8.0

import { ApiResponse } from './types';
import { Client } from '../types/client';
import { createApiInstance } from '../utils/api';
import { RequestValidator } from '../utils/validation';
import { API_ENDPOINTS, API_CONFIG } from '../config/api';

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
  config: {
    chatEnabled: boolean;
    exportEnabled: boolean;
    maxUsers: number;
    features: Record<string, unknown>;
  };
  branding?: {
    primaryColor: string;
    logoUrl: string;
    companyName: string;
    customStyles?: Record<string, string>;
  };
}

/**
 * Interface for enhanced request options
 */
interface RequestOptions {
  skipRetry?: boolean;
  timeout?: number;
  useCircuitBreaker?: boolean;
  customHeaders?: Record<string, string>;
}

/**
 * Retrieves a paginated list of clients with enhanced error handling and monitoring
 * @param params - Pagination and filtering parameters
 * @param options - Request configuration options
 * @returns Promise resolving to paginated client list
 */
export const getClients = async (
  params: GetClientsParams,
  options: RequestOptions = {}
): Promise<ApiResponse<Client[]>> => {
  const validator = new RequestValidator();
  validator.validate(params, {
    page: { required: true, type: 'number', min: 1 },
    limit: { required: true, type: 'number', min: 1, max: 100 }
  });

  const api = createApiInstance({
    timeout: options.timeout || API_CONFIG.TIMEOUT,
    useCircuitBreaker: options.useCircuitBreaker,
    customHeaders: {
      'X-Request-Type': 'LIST',
      ...options.customHeaders
    }
  });

  try {
    const response = await api.get(API_ENDPOINTS.CLIENTS.LIST, {
      params,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Failed to fetch clients:', error);
    throw error;
  }
};

/**
 * Retrieves a specific client by ID with enhanced validation and security
 * @param clientId - Unique identifier of the client
 * @param options - Request configuration options
 * @returns Promise resolving to client details
 */
export const getClientById = async (
  clientId: string,
  options: RequestOptions = {}
): Promise<ApiResponse<Client>> => {
  const validator = new RequestValidator();
  validator.validate({ clientId }, {
    clientId: { required: true, type: 'string', format: 'uuid' }
  });

  const api = createApiInstance({
    timeout: options.timeout,
    useCircuitBreaker: options.useCircuitBreaker,
    customHeaders: {
      'X-Request-Type': 'GET',
      ...options.customHeaders
    }
  });

  try {
    const response = await api.get(
      API_ENDPOINTS.CLIENTS.LIST + `/${clientId}`,
      {
        headers: {
          'Cache-Control': 'no-cache'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error(`Failed to fetch client ${clientId}:`, error);
    throw error;
  }
};

/**
 * Creates a new client with comprehensive validation and security checks
 * @param payload - Client creation payload
 * @param options - Request configuration options
 * @returns Promise resolving to created client details
 */
export const createClient = async (
  payload: ClientPayload,
  options: RequestOptions = {}
): Promise<ApiResponse<Client>> => {
  const validator = new RequestValidator();
  validator.validate(payload, {
    name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    config: { required: true, type: 'object' },
    'config.maxUsers': { required: true, type: 'number', min: 1 }
  });

  const api = createApiInstance({
    timeout: options.timeout,
    useCircuitBreaker: options.useCircuitBreaker,
    customHeaders: {
      'X-Request-Type': 'CREATE',
      'Content-Type': 'application/json',
      ...options.customHeaders
    }
  });

  try {
    const response = await api.post(API_ENDPOINTS.CLIENTS.CREATE, payload);
    return response.data;
  } catch (error) {
    console.error('Failed to create client:', error);
    throw error;
  }
};

/**
 * Updates an existing client with validation and security checks
 * @param clientId - Unique identifier of the client
 * @param payload - Client update payload
 * @param options - Request configuration options
 * @returns Promise resolving to updated client details
 */
export const updateClient = async (
  clientId: string,
  payload: Partial<ClientPayload>,
  options: RequestOptions = {}
): Promise<ApiResponse<Client>> => {
  const validator = new RequestValidator();
  validator.validate({ clientId, ...payload }, {
    clientId: { required: true, type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 2, maxLength: 100 }
  });

  const api = createApiInstance({
    timeout: options.timeout,
    useCircuitBreaker: options.useCircuitBreaker,
    customHeaders: {
      'X-Request-Type': 'UPDATE',
      'Content-Type': 'application/json',
      ...options.customHeaders
    }
  });

  try {
    const response = await api.put(
      API_ENDPOINTS.CLIENTS.UPDATE.replace('{id}', clientId),
      payload
    );
    return response.data;
  } catch (error) {
    console.error(`Failed to update client ${clientId}:`, error);
    throw error;
  }
};

/**
 * Deletes a client with security validation and cascade handling
 * @param clientId - Unique identifier of the client
 * @param options - Request configuration options
 * @returns Promise resolving to deletion confirmation
 */
export const deleteClient = async (
  clientId: string,
  options: RequestOptions = {}
): Promise<ApiResponse<void>> => {
  const validator = new RequestValidator();
  validator.validate({ clientId }, {
    clientId: { required: true, type: 'string', format: 'uuid' }
  });

  const api = createApiInstance({
    timeout: options.timeout,
    useCircuitBreaker: options.useCircuitBreaker,
    customHeaders: {
      'X-Request-Type': 'DELETE',
      ...options.customHeaders
    }
  });

  try {
    const response = await api.delete(
      API_ENDPOINTS.CLIENTS.DELETE.replace('{id}', clientId)
    );
    return response.data;
  } catch (error) {
    console.error(`Failed to delete client ${clientId}:`, error);
    throw error;
  }
};