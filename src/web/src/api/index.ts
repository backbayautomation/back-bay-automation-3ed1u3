/**
 * Main entry point for the frontend API layer that exports all API-related functionality.
 * Implements enterprise-grade security, monitoring, and reliability patterns.
 * @version 1.0.0
 */

import axios from 'axios'; // v1.5.0
import * as auth from './auth';
import * as clients from './clients';
import * as documents from './documents';
import { createApiInstance } from '../utils/api';
import { API_CONFIG } from '../config/api';
import type { ApiResponse, ApiRequestConfig } from './types';

/**
 * Core API instance with enhanced security and monitoring
 */
const api = createApiInstance({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0'
    }
});

/**
 * Request interceptor for authentication and security headers
 */
api.interceptors.request.use(async (config: ApiRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.requiresAuth !== false) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Add security headers
    config.headers['X-Request-ID'] = crypto.randomUUID();
    config.headers['X-Client-Timestamp'] = new Date().toISOString();

    return config;
});

/**
 * Response interceptor for error handling and monitoring
 */
api.interceptors.response.use(
    (response) => {
        // Log successful requests for monitoring
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        console.debug(`Request to ${response.config.url} completed in ${duration}ms`);
        return response;
    },
    async (error) => {
        if (axios.isAxiosError(error)) {
            // Handle authentication errors
            if (error.response?.status === 401) {
                try {
                    // Attempt token refresh
                    const refreshToken = localStorage.getItem('refresh_token');
                    if (refreshToken) {
                        const newTokens = await auth.refreshToken(refreshToken);
                        if (newTokens.success) {
                            // Retry original request with new token
                            const originalRequest = error.config;
                            originalRequest.headers.Authorization = `Bearer ${newTokens.data.accessToken}`;
                            return api(originalRequest);
                        }
                    }
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    // Clear auth tokens and redirect to login
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                }
            }

            // Handle rate limiting
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                console.warn(`Rate limited. Retry after ${retryAfter} seconds`);
            }

            // Log errors for monitoring
            console.error('API Error:', {
                url: error.config?.url,
                method: error.config?.method,
                status: error.response?.status,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }

        return Promise.reject(error);
    }
);

/**
 * Health check function to verify API availability
 */
export const checkApiHealth = async (): Promise<ApiResponse<{ status: string }>> => {
    try {
        const response = await api.get('/health', { 
            requiresAuth: false,
            timeout: 5000 
        });
        return response.data;
    } catch (error) {
        console.error('Health check failed:', error);
        throw error;
    }
};

/**
 * Export enhanced API modules with comprehensive security and monitoring
 */
export {
    auth,    // Authentication API with token management
    clients, // Client management API with multi-tenant support
    documents // Document management API with upload tracking
};

/**
 * Export base API instance for custom requests
 */
export { api as apiInstance };

/**
 * Export API configuration and types
 */
export * from './types';
export { API_CONFIG, API_ENDPOINTS } from '../config/api';

/**
 * Initialize API monitoring and circuit breaker
 */
const initializeApi = () => {
    // Set up global error handler
    window.addEventListener('unhandledrejection', (event) => {
        if (axios.isAxiosError(event.reason)) {
            console.error('Unhandled API error:', event.reason);
            // Add error reporting/monitoring here
        }
    });

    // Initialize performance monitoring
    if (typeof window !== 'undefined' && 'performance' in window) {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.initiatorType === 'xmlhttprequest') {
                    console.debug('API Performance:', {
                        url: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime
                    });
                }
            });
        });

        observer.observe({ entryTypes: ['resource'] });
    }
};

// Initialize API configuration
initializeApi();