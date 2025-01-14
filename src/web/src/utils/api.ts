/**
 * Core API utility functions for frontend application with comprehensive security controls,
 * request/response interceptors, retry logic, and monitoring capabilities.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios'; // v1.5.0
import { API_CONFIG } from '../config/api';
import { ApiResponse } from '../types/common';

/**
 * Interface for extended request options with authentication and retry controls
 */
export interface RequestOptions {
  skipAuth?: boolean;
  skipRetry?: boolean;
  customTimeout?: number;
  useCircuitBreaker?: boolean;
  customHeaders?: Record<string, string>;
}

/**
 * Interface for standardized error responses with detailed categorization
 */
interface ErrorResponse {
  message: string;
  code: string;
  details: any;
  errorType: 'network' | 'auth' | 'validation' | 'server';
  timestamp: number;
  requestId: string;
}

/**
 * Circuit breaker state tracking
 */
const circuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
};

/**
 * Creates and configures an Axios instance with comprehensive security controls
 */
export const createApiInstance = (options: RequestOptions = {}): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: options.customTimeout || API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0',
      ...options.customHeaders,
    },
  });

  // Request interceptor for authentication and monitoring
  instance.interceptors.request.use(
    async (config) => {
      // Add request timing metadata
      config.metadata = { startTime: Date.now() };

      // Add authentication header if not skipped
      if (!options.skipAuth) {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      // Add request tracking ID
      config.headers['X-Request-ID'] = generateRequestId();

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling and response transformation
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Reset circuit breaker on successful response
      if (options.useCircuitBreaker) {
        circuitBreakerState.failures = 0;
        circuitBreakerState.isOpen = false;
      }

      // Add response timing metrics
      const duration = Date.now() - (response.config.metadata?.startTime || 0);
      response.headers['X-Response-Time'] = duration.toString();

      // Transform response to standardized format
      const apiResponse = response.data as ApiResponse<unknown>;
      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'Unknown error occurred');
      }

      return response;
    },
    async (error: AxiosError) => {
      // Check circuit breaker state
      if (options.useCircuitBreaker && circuitBreakerState.isOpen) {
        return Promise.reject(new Error('Circuit breaker is open'));
      }

      // Handle retry logic if not skipped
      if (!options.skipRetry && await shouldRetryRequest(error)) {
        return instance(error.config!);
      }

      // Process and standardize error response
      const errorResponse = await handleApiError(error);

      // Update circuit breaker state if enabled
      if (options.useCircuitBreaker) {
        updateCircuitBreakerState();
      }

      return Promise.reject(errorResponse);
    }
  );

  return instance;
};

/**
 * Processes API errors with comprehensive error categorization
 */
export const handleApiError = async (error: AxiosError): Promise<ErrorResponse> => {
  const timestamp = Date.now();
  const requestId = error.config?.headers?.['X-Request-ID'] || generateRequestId();

  // Handle network errors
  if (!error.response) {
    return {
      message: 'Network error occurred. Please check your connection.',
      code: 'NETWORK_ERROR',
      details: error.message,
      errorType: 'network',
      timestamp,
      requestId,
    };
  }

  // Handle authentication errors
  if (error.response.status === 401) {
    // Attempt token refresh if available
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      throw new Error('TOKEN_REFRESH_REQUIRED');
    }

    return {
      message: 'Authentication failed. Please log in again.',
      code: 'AUTH_ERROR',
      details: error.response.data,
      errorType: 'auth',
      timestamp,
      requestId,
    };
  }

  // Handle validation errors
  if (error.response.status === 400) {
    return {
      message: 'Validation error occurred. Please check your input.',
      code: 'VALIDATION_ERROR',
      details: error.response.data,
      errorType: 'validation',
      timestamp,
      requestId,
    };
  }

  // Handle server errors
  return {
    message: 'An unexpected error occurred. Please try again later.',
    code: 'SERVER_ERROR',
    details: error.response.data,
    errorType: 'server',
    timestamp,
    requestId,
  };
};

/**
 * Implements retry logic with exponential backoff
 */
const shouldRetryRequest = async (error: AxiosError): Promise<boolean> => {
  const retryCount = (error.config?.metadata?.retryCount || 0) + 1;
  
  // Check if max retries exceeded
  if (retryCount > API_CONFIG.RETRY_ATTEMPTS) {
    return false;
  }

  // Only retry on network errors or specific status codes
  if (!error.response || [408, 429, 500, 502, 503, 504].includes(error.response.status)) {
    // Calculate exponential backoff with jitter
    const backoff = Math.min(
      1000 * Math.pow(2, retryCount) + Math.random() * 1000,
      API_CONFIG.MAX_BACKOFF_MS
    );

    // Wait for backoff period
    await new Promise(resolve => setTimeout(resolve, backoff));

    // Update retry count in config
    if (error.config) {
      error.config.metadata = {
        ...error.config.metadata,
        retryCount,
      };
    }

    return true;
  }

  return false;
};

/**
 * Updates circuit breaker state based on failure patterns
 */
const updateCircuitBreakerState = (): void => {
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailure = Date.now();

  if (circuitBreakerState.failures >= 5) {
    circuitBreakerState.isOpen = true;
    setTimeout(() => {
      circuitBreakerState.isOpen = false;
      circuitBreakerState.failures = 0;
    }, 60000); // Reset after 1 minute
  }
};

/**
 * Attempts to refresh the authentication token
 */
const attemptTokenRefresh = async (): Promise<boolean> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await axios.post(`${API_CONFIG.BASE_URL}/auth/refresh`, {
      refreshToken,
    });

    if (response.data.success) {
      localStorage.setItem('access_token', response.data.data.accessToken);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }

  return false;
};

/**
 * Generates a unique request ID for tracking
 */
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};