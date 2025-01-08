/**
 * Core API utility functions and request handling implementation.
 * Provides robust error handling, request/response interceptors, retry logic,
 * and standardized API communication patterns with security controls.
 * @version 1.0.0
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'; // v1.5.0
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

  // Request interceptor for authentication
  if (!options.skipAuth) {
    instance.interceptors.request.use(async (config) => {
      const token = localStorage.getItem('auth_token');
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

  // Response interceptor for error handling and monitoring
  instance.interceptors.response.use(
    (response) => {
      // Reset circuit breaker on successful response
      if (options.useCircuitBreaker) {
        circuitBreakerState.failures = 0;
        circuitBreakerState.isOpen = false;
      }

      // Log request duration
      const duration = Date.now() - (response.config.metadata?.startTime || 0);
      console.debug(`Request to ${response.config.url} completed in ${duration}ms`);

      return response;
    },
    async (error: AxiosError) => {
      const errorResponse = await handleApiError(error);

      // Update circuit breaker state
      if (options.useCircuitBreaker) {
        circuitBreakerState.failures++;
        circuitBreakerState.lastFailure = Date.now();
        if (circuitBreakerState.failures >= API_CONFIG.RETRY_ATTEMPTS) {
          circuitBreakerState.isOpen = true;
        }
      }

      // Implement retry logic if not skipped
      if (!options.skipRetry && await retryRequest(error, circuitBreakerState.failures)) {
        return instance(error.config!);
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
  const requestId = Math.random().toString(36).substring(7);

  // Network errors
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

  // Authentication errors
  if (error.response.status === 401) {
    // Attempt token refresh if available
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        // Token refresh logic would go here
        // For now, just clear tokens and return auth error
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
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

  // Validation errors
  if (error.response.status === 400) {
    return {
      message: 'Invalid request. Please check your input.',
      code: 'VALIDATION_ERROR',
      details: error.response.data,
      errorType: 'validation',
      timestamp,
      requestId,
    };
  }

  // Server errors
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
 * Implements sophisticated retry logic with exponential backoff
 */
const retryRequest = async (error: AxiosError, retryCount: number): Promise<boolean> => {
  // Don't retry if max attempts reached
  if (retryCount >= API_CONFIG.RETRY_ATTEMPTS) {
    return false;
  }

  // Don't retry certain status codes
  const status = error.response?.status;
  if (status && [400, 401, 403, 404].includes(status)) {
    return false;
  }

  // Calculate exponential backoff with jitter
  const backoff = Math.min(
    API_CONFIG.MAX_BACKOFF_MS,
    Math.pow(2, retryCount) * 1000 + Math.random() * 1000
  );

  // Wait for backoff period
  await new Promise(resolve => setTimeout(resolve, backoff));

  // Check circuit breaker
  if (circuitBreakerState.isOpen) {
    const cooldownPeriod = 60000; // 1 minute
    if (Date.now() - circuitBreakerState.lastFailure < cooldownPeriod) {
      return false;
    }
    // Reset circuit breaker for retry
    circuitBreakerState.isOpen = false;
    circuitBreakerState.failures = 0;
  }

  return true;
};