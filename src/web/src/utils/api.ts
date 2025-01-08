/**
 * Core API utility functions and request handling implementation.
 * Provides robust error handling, request/response interceptors,
 * retry logic, and standardized API communication patterns.
 * @version 1.0.0
 */

// External dependencies
import axios, { AxiosError, AxiosInstance } from 'axios'; // v1.5.0

// Internal dependencies
import { API_CONFIG } from '../config/api';
import { ApiResponse } from '../types/common';

/**
 * Extended request options interface with authentication and retry controls
 */
export interface RequestOptions {
  skipAuth?: boolean;
  skipRetry?: boolean;
  customTimeout?: number;
  useCircuitBreaker?: boolean;
  customHeaders?: Record<string, string>;
}

/**
 * Standardized error response interface with detailed categorization
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
      ...options.customHeaders,
    },
  });

  // Request interceptor for authentication
  if (!options.skipAuth) {
    instance.interceptors.request.use(async (config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Request timing interceptor
  instance.interceptors.request.use((config) => {
    config.metadata = { startTime: Date.now() };
    return config;
  });

  // Response interceptor for error handling and transformation
  instance.interceptors.response.use(
    (response) => {
      // Reset circuit breaker on successful response
      if (options.useCircuitBreaker) {
        circuitBreakerState.failures = 0;
        circuitBreakerState.isOpen = false;
      }

      // Calculate request duration
      const duration = Date.now() - response.config.metadata.startTime;
      console.debug(`API call to ${response.config.url} completed in ${duration}ms`);

      return response;
    },
    async (error: AxiosError) => {
      // Handle circuit breaker logic
      if (options.useCircuitBreaker) {
        circuitBreakerState.failures++;
        circuitBreakerState.lastFailure = Date.now();
        if (circuitBreakerState.failures >= 5) {
          circuitBreakerState.isOpen = true;
        }
      }

      // Process error through handler
      const errorResponse = await handleApiError(error);
      return Promise.reject(errorResponse);
    }
  );

  // Configure retry logic if not skipped
  if (!options.skipRetry) {
    instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const shouldRetry = await retryRequest(error, 0);
        if (shouldRetry) {
          return instance(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  return instance;
};

/**
 * Processes API errors with comprehensive error categorization
 */
export const handleApiError = async (error: AxiosError): Promise<ErrorResponse> => {
  const timestamp = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Network or connection errors
  if (!error.response) {
    return {
      message: 'Unable to connect to the server. Please check your internet connection.',
      code: 'NETWORK_ERROR',
      details: error.message,
      errorType: 'network',
      timestamp,
      requestId,
    };
  }

  // Authentication errors
  if (error.response.status === 401) {
    // Attempt token refresh if available
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        // Token refresh logic would go here
        // For now, just clear tokens and return auth error
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }

    return {
      message: 'Your session has expired. Please log in again.',
      code: 'AUTH_ERROR',
      details: error.response.data,
      errorType: 'auth',
      timestamp,
      requestId,
    };
  }

  // Validation errors
  if (error.response.status === 400) {
    return {
      message: 'The request contains invalid data. Please check your input.',
      code: 'VALIDATION_ERROR',
      details: error.response.data,
      errorType: 'validation',
      timestamp,
      requestId,
    };
  }

  // Rate limiting errors
  if (error.response.status === 429) {
    return {
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_ERROR',
      details: error.response.data,
      errorType: 'server',
      timestamp,
      requestId,
    };
  }

  // Server errors
  if (error.response.status >= 500) {
    return {
      message: 'An unexpected error occurred. Please try again later.',
      code: 'SERVER_ERROR',
      details: error.response.data,
      errorType: 'server',
      timestamp,
      requestId,
    };
  }

  // Default error response
  return {
    message: 'An unexpected error occurred.',
    code: 'UNKNOWN_ERROR',
    details: error.response?.data || error.message,
    errorType: 'server',
    timestamp,
    requestId,
  };
};

/**
 * Implements sophisticated retry logic with exponential backoff
 */
const retryRequest = async (error: AxiosError, retryCount: number): Promise<boolean> => {
  // Don't retry if max attempts reached
  if (retryCount >= API_CONFIG.RETRY_ATTEMPTS) {
    return false;
  }

  // Don't retry certain error types
  if (error.response) {
    const status = error.response.status;
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      return false;
    }
  }

  // Calculate exponential backoff with jitter
  const backoff = Math.min(
    1000 * Math.pow(2, retryCount) + Math.random() * 1000,
    API_CONFIG.MAX_BACKOFF_MS
  );

  // Wait for backoff period
  await new Promise(resolve => setTimeout(resolve, backoff));

  // Log retry attempt
  console.debug(`Retrying request (attempt ${retryCount + 1} of ${API_CONFIG.RETRY_ATTEMPTS})`);

  return true;
};