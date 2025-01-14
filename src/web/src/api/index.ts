/**
 * Main entry point for the frontend API layer providing centralized access to all API functionality
 * with comprehensive security controls, error handling, and monitoring capabilities.
 * @version 1.0.0
 */

// Import external dependencies
import axios from 'axios'; // v1.5.0

// Import internal modules
import * as auth from './auth';
import * as clients from './clients';
import * as documents from './documents';
import { createApiInstance, RequestOptions } from '../utils/api';
import { API_CONFIG } from '../config/api';
import { ApiResponse } from './types';

/**
 * Initialize global API configuration with security and monitoring
 */
const globalApiInstance = createApiInstance({
    useCircuitBreaker: true,
    customHeaders: {
        'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0',
        'X-Platform': 'web'
    }
});

// Configure global axios defaults
axios.defaults.baseURL = API_CONFIG.BASE_URL;
axios.defaults.timeout = API_CONFIG.TIMEOUT;
axios.defaults.headers.common['Accept'] = 'application/json';

/**
 * Enhanced error handler with monitoring and logging
 */
const handleGlobalError = (error: unknown): never => {
    // Log error details
    console.error('API Error:', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: axios.defaults.headers.common['X-Request-ID']
    });

    // Rethrow with additional context
    throw error;
};

/**
 * Authentication API with enhanced security and token management
 */
export const authApi = {
    login: auth.login,
    logout: auth.logout,
    refreshToken: auth.refreshToken,
    getCurrentUser: auth.getCurrentUser
};

/**
 * Client management API with multi-tenant support
 */
export const clientApi = {
    getClients: clients.getClients,
    getClientById: clients.getClientById,
    createClient: clients.createClient,
    updateClient: clients.updateClient,
    deleteClient: clients.deleteClient
};

/**
 * Document management API with upload tracking and processing
 */
export const documentApi = {
    uploadDocument: documents.documentApi.uploadDocument.bind(documents.documentApi),
    getDocuments: documents.documentApi.getDocuments.bind(documents.documentApi)
};

/**
 * Health check endpoint to verify API availability
 */
export const checkApiHealth = async (): Promise<ApiResponse<{ status: string }>> => {
    try {
        const response = await globalApiInstance.get('/health', {
            timeout: 5000, // Short timeout for health checks
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        return response.data;
    } catch (error) {
        handleGlobalError(error);
    }
};

/**
 * API version information
 */
export const API_VERSION = {
    version: '1.0.0',
    buildNumber: process.env.VITE_BUILD_NUMBER,
    environment: process.env.NODE_ENV
} as const;

/**
 * Export all API-related types for consumer usage
 */
export type {
    ApiResponse,
    RequestOptions
};

/**
 * Export API configuration for external consumption
 */
export { API_CONFIG };

/**
 * Default export providing all API functionality
 */
export default {
    auth: authApi,
    clients: clientApi,
    documents: documentApi,
    health: checkApiHealth,
    version: API_VERSION
};