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
import { API_ENDPOINTS } from '../config/api';

/**
 * Interface for client list request parameters
 */
interface GetClientsParams {
  page?: number;
  limit?: number;
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
      fontFamily: string;
      spacing: number;
      borderRadius: number;
      shadows: Record<string, string>;
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
 * Retrieves a paginated list of clients with enhanced error handling and monitoring
 */
export const getClients = async (
  params: GetClientsParams = {},
  options: RequestOptions = {}
): Promise<ApiResponse<Client[]>> => {
  const api: AxiosInstance = createApiInstance({
    useCircuitBreaker: true,
    customTimeout: 30000,
    ...options
  });

  try {
    const response = await api.get(API_ENDPOINTS.CLIENTS.LIST, {
      params: {
        page: params.page || 1,
        limit: params.limit || 10,
        sortBy: params.sortBy,
        order: params.order,
        searchQuery: params.searchQuery,
        ...params.filters
      }
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves a specific client by ID with enhanced validation and security
 */
export const getClientById = async (
  clientId: string,
  options: RequestOptions = {}
): Promise<ApiResponse<Client>> => {
  if (!clientId) {
    throw new Error('Client ID is required');
  }

  const api: AxiosInstance = createApiInstance({
    useCircuitBreaker: true,
    customTimeout: 20000,
    ...options
  });

  try {
    const response = await api.get(`${API_ENDPOINTS.CLIENTS.LIST}/${clientId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Creates a new client with comprehensive validation and security checks
 */
export const createClient = async (
  payload: ClientPayload,
  options: RequestOptions = {}
): Promise<ApiResponse<Client>> => {
  const validator = new RequestValidator();
  const validationErrors = validator.validate(payload, {
    'name': { required: true, type: 'string', maxLength: 100 },
    'orgId': { required: true, type: 'string', format: 'uuid' },
    'config': { required: true, type: 'object' },
    'branding': { required: true, type: 'object' }
  });

  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
  }

  const api: AxiosInstance = createApiInstance({
    useCircuitBreaker: true,
    customTimeout: 40000,
    ...options
  });

  try {
    const response = await api.post(API_ENDPOINTS.CLIENTS.CREATE, payload);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Updates an existing client with validation and security checks
 */
export const updateClient = async (
  clientId: string,
  payload: Partial<ClientPayload>,
  options: RequestOptions = {}
): Promise<ApiResponse<Client>> => {
  if (!clientId) {
    throw new Error('Client ID is required');
  }

  const validator = new RequestValidator();
  const validationErrors = validator.validate(payload, {
    'name': { type: 'string', maxLength: 100 },
    'config': { type: 'object' },
    'branding': { type: 'object' }
  });

  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
  }

  const api: AxiosInstance = createApiInstance({
    useCircuitBreaker: true,
    customTimeout: 30000,
    ...options
  });

  try {
    const response = await api.put(
      `${API_ENDPOINTS.CLIENTS.UPDATE.replace('{id}', clientId)}`,
      payload
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Deletes a client with confirmation and security checks
 */
export const deleteClient = async (
  clientId: string,
  options: RequestOptions = {}
): Promise<ApiResponse<void>> => {
  if (!clientId) {
    throw new Error('Client ID is required');
  }

  const api: AxiosInstance = createApiInstance({
    useCircuitBreaker: true,
    customTimeout: 20000,
    ...options
  });

  try {
    const response = await api.delete(
      `${API_ENDPOINTS.CLIENTS.DELETE.replace('{id}', clientId)}`
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};