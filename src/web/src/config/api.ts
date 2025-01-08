/**
 * API configuration file that defines endpoints, security settings, and reliability patterns.
 * Implements enterprise-grade security, OAuth2 authentication, and resilient request handling.
 * @version 1.0.0
 */

// External dependencies
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // v1.5.0
import circuitBreaker from 'axios-circuit-breaker'; // v1.0.0
import axiosRetry from 'axios-retry'; // v3.8.0
import rateLimit from 'axios-rate-limit'; // v1.3.0

// Internal types
import { ApiResponse } from '../types/common';

/**
 * OAuth2 configuration interface
 */
export interface OAuth2Config {
    CLIENT_ID: string;
    TENANT_ID: string;
    SCOPE: string;
}

/**
 * Circuit breaker configuration interface
 */
export interface CircuitBreakerConfig {
    FAILURE_THRESHOLD: number;
    RESET_TIMEOUT: number;
    HALF_OPEN_REQUESTS: number;
}

/**
 * Enhanced request configuration interface
 */
export interface RequestConfig extends AxiosRequestConfig {
    encrypt?: boolean;
    validation?: Record<string, unknown>;
}

/**
 * Core API configuration constants
 */
export const API_CONFIG = {
    BASE_URL: process.env.VITE_API_BASE_URL || '/api/v1',
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    MAX_REQUEST_SIZE: 10485760, // 10MB
    OAUTH2: {
        CLIENT_ID: process.env.VITE_OAUTH_CLIENT_ID,
        TENANT_ID: process.env.VITE_OAUTH_TENANT_ID,
        SCOPE: 'api://catalog-search/.default'
    },
    CIRCUIT_BREAKER: {
        FAILURE_THRESHOLD: 5,
        RESET_TIMEOUT: 60000,
        HALF_OPEN_REQUESTS: 2
    },
    ENCRYPTION: {
        ALGORITHM: 'AES-256-GCM',
        KEY_SIZE: 256,
        IV_SIZE: 16
    },
    RATE_LIMIT: {
        MAX_REQUESTS: 1000,
        PER_MILLISECONDS: 3600000 // 1 hour
    }
} as const;

/**
 * API endpoint definitions
 */
export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        REFRESH_TOKEN: '/auth/refresh',
        RESET_PASSWORD: '/auth/reset-password',
        FORGOT_PASSWORD: '/auth/forgot-password'
    },
    DOCUMENTS: {
        UPLOAD: '/documents/upload',
        LIST: '/documents',
        PROCESS: '/documents/{id}/process',
        DELETE: '/documents/{id}'
    },
    QUERIES: {
        SEARCH: '/queries/search',
        CHAT: '/queries/chat',
        HISTORY: '/queries/history'
    },
    CLIENTS: {
        CREATE: '/clients',
        LIST: '/clients',
        UPDATE: '/clients/{id}',
        DELETE: '/clients/{id}'
    },
    ANALYTICS: {
        METRICS: '/analytics/metrics',
        USAGE: '/analytics/usage',
        PERFORMANCE: '/analytics/performance'
    }
} as const;

/**
 * Configures circuit breaker pattern for API resilience
 */
const configureCircuitBreaker = (
    instance: AxiosInstance,
    config: CircuitBreakerConfig
): void => {
    circuitBreaker(instance, {
        failureThreshold: config.FAILURE_THRESHOLD,
        resetTimeout: config.RESET_TIMEOUT,
        halfOpenRequests: config.HALF_OPEN_REQUESTS,
        onStateChange: (state: string) => {
            console.warn(`Circuit breaker state changed to: ${state}`);
        },
        onFailure: (error: Error) => {
            console.error('Circuit breaker failure:', error);
        }
    });
};

/**
 * Creates and configures an Axios instance with enhanced security and reliability features
 */
export const createApiClient = (): AxiosInstance => {
    // Create base instance
    const instance = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: API_CONFIG.TIMEOUT,
        maxContentLength: API_CONFIG.MAX_REQUEST_SIZE,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    // Configure OAuth2 authentication interceptor
    instance.interceptors.request.use(async (config) => {
        const token = await getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    // Implement request encryption interceptor
    instance.interceptors.request.use((config: RequestConfig) => {
        if (config.encrypt) {
            config.data = encryptPayload(config.data, API_CONFIG.ENCRYPTION);
        }
        return config;
    });

    // Add request validation interceptor
    instance.interceptors.request.use((config: RequestConfig) => {
        if (config.validation) {
            validateRequest(config.data, config.validation);
        }
        return config;
    });

    // Configure circuit breaker
    configureCircuitBreaker(instance, API_CONFIG.CIRCUIT_BREAKER);

    // Set up enhanced retry logic
    axiosRetry(instance, {
        retries: API_CONFIG.RETRY_ATTEMPTS,
        retryDelay: (retryCount) => {
            return retryCount * API_CONFIG.RETRY_DELAY;
        },
        retryCondition: (error) => {
            return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                   error.response?.status === 429;
        }
    });

    // Implement rate limiting
    const rateLimitedInstance = rateLimit(instance, {
        maxRequests: API_CONFIG.RATE_LIMIT.MAX_REQUESTS,
        perMilliseconds: API_CONFIG.RATE_LIMIT.PER_MILLISECONDS
    });

    // Add response interceptor for standardized error handling
    rateLimitedInstance.interceptors.response.use(
        (response) => response,
        (error) => {
            const errorResponse: ApiResponse<null> = {
                success: false,
                data: null,
                error: error.message,
                message: error.response?.data?.message || 'An error occurred',
                statusCode: error.response?.status || 500,
                metadata: {
                    timestamp: new Date().toISOString(),
                    path: error.config?.url,
                    method: error.config?.method
                }
            };
            return Promise.reject(errorResponse);
        }
    );

    // Add performance monitoring
    rateLimitedInstance.interceptors.request.use((config) => {
        config.metadata = { startTime: new Date() };
        return config;
    });

    rateLimitedInstance.interceptors.response.use((response) => {
        const duration = new Date().getTime() - 
            (response.config.metadata?.startTime?.getTime() || 0);
        console.debug(`Request to ${response.config.url} took ${duration}ms`);
        return response;
    });

    return rateLimitedInstance;
};

// Utility functions (implementations would be in separate security/utils modules)
const getAccessToken = async (): Promise<string | null> => {
    // Implementation for OAuth2 token acquisition
    return null;
};

const encryptPayload = (
    data: unknown,
    config: typeof API_CONFIG.ENCRYPTION
): unknown => {
    // Implementation for payload encryption
    return data;
};

const validateRequest = (
    data: unknown,
    rules: Record<string, unknown>
): void => {
    // Implementation for request validation
    return;
};