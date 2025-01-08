/**
 * Comprehensive test suite for core API utility functions.
 * Tests request handling, error processing, retry logic, and circuit breaker patterns.
 * @version 1.0.0
 */

// External dependencies
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import axios from 'axios'; // v1.5.0
import MockAdapter from 'axios-mock-adapter'; // v1.21.0

// Internal dependencies
import { createApiInstance, handleApiError } from '../../src/utils/api';
import { API_CONFIG } from '../../src/config/api';
import { ApiResponse } from '../../src/types/common';

// Mock setup
const mockAxios = new MockAdapter(axios);
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

// Replace global localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('createApiInstance', () => {
  beforeEach(() => {
    mockAxios.reset();
    jest.clearAllMocks();
  });

  test('should create instance with default security configuration', () => {
    const instance = createApiInstance();
    expect(instance.defaults.baseURL).toBe(API_CONFIG.BASE_URL);
    expect(instance.defaults.timeout).toBe(API_CONFIG.TIMEOUT);
    expect(instance.defaults.headers['Content-Type']).toBe('application/json');
  });

  test('should respect custom timeout and retry settings', () => {
    const customTimeout = 5000;
    const instance = createApiInstance({ 
      customTimeout,
      skipRetry: true 
    });
    expect(instance.defaults.timeout).toBe(customTimeout);
  });

  test('should add authorization header when token exists', async () => {
    const mockToken = 'mock-jwt-token';
    mockLocalStorage.getItem.mockReturnValue(mockToken);
    
    const instance = createApiInstance();
    const config = await instance.interceptors.request.handlers[0].fulfilled({
      headers: {}
    });
    
    expect(config.headers.Authorization).toBe(`Bearer ${mockToken}`);
  });

  test('should handle custom security headers', () => {
    const customHeaders = {
      'X-Custom-Security': 'test-value',
      'X-API-Key': 'test-key'
    };
    
    const instance = createApiInstance({ customHeaders });
    expect(instance.defaults.headers['X-Custom-Security']).toBe('test-value');
    expect(instance.defaults.headers['X-API-Key']).toBe('test-key');
  });

  test('should track request timing metadata', async () => {
    const instance = createApiInstance();
    const config = await instance.interceptors.request.handlers[1].fulfilled({});
    expect(config.metadata.startTime).toBeDefined();
  });
});

describe('handleApiError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle network errors with retry logic', async () => {
    const networkError = new axios.AxiosError(
      'Network Error',
      'ECONNABORTED'
    );
    
    const errorResponse = await handleApiError(networkError);
    expect(errorResponse.code).toBe('NETWORK_ERROR');
    expect(errorResponse.errorType).toBe('network');
  });

  test('should handle authentication errors with token refresh', async () => {
    const authError = new axios.AxiosError(
      'Unauthorized',
      '401',
      undefined,
      undefined,
      {
        status: 401,
        data: { message: 'Token expired' }
      } as any
    );
    
    mockLocalStorage.getItem.mockReturnValue('mock-refresh-token');
    const errorResponse = await handleApiError(authError);
    
    expect(errorResponse.code).toBe('AUTH_ERROR');
    expect(errorResponse.errorType).toBe('auth');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('accessToken');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken');
  });

  test('should handle validation errors with field details', async () => {
    const validationError = new axios.AxiosError(
      'Bad Request',
      '400',
      undefined,
      undefined,
      {
        status: 400,
        data: { 
          fields: { 
            email: 'Invalid email format' 
          } 
        }
      } as any
    );
    
    const errorResponse = await handleApiError(validationError);
    expect(errorResponse.code).toBe('VALIDATION_ERROR');
    expect(errorResponse.errorType).toBe('validation');
    expect(errorResponse.details).toBeDefined();
  });

  test('should handle rate limiting errors', async () => {
    const rateLimitError = new axios.AxiosError(
      'Too Many Requests',
      '429',
      undefined,
      undefined,
      {
        status: 429,
        data: { retryAfter: 60 }
      } as any
    );
    
    const errorResponse = await handleApiError(rateLimitError);
    expect(errorResponse.code).toBe('RATE_LIMIT_ERROR');
    expect(errorResponse.errorType).toBe('server');
  });

  test('should handle server errors with circuit breaker', async () => {
    const serverError = new axios.AxiosError(
      'Internal Server Error',
      '500',
      undefined,
      undefined,
      {
        status: 500,
        data: { message: 'Server error' }
      } as any
    );
    
    const errorResponse = await handleApiError(serverError);
    expect(errorResponse.code).toBe('SERVER_ERROR');
    expect(errorResponse.errorType).toBe('server');
  });
});

describe('retry logic', () => {
  beforeEach(() => {
    mockAxios.reset();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should implement exponential backoff', async () => {
    const instance = createApiInstance();
    mockAxios.onGet('/test').replyOnce(500).onGet('/test').reply(200, {});
    
    try {
      await instance.get('/test');
    } catch (error) {
      // First attempt fails
      expect(mockAxios.history.get.length).toBe(1);
      
      // Wait for backoff
      jest.advanceTimersByTime(2000);
      
      // Retry succeeds
      expect(mockAxios.history.get.length).toBe(2);
    }
  });

  test('should respect retry attempt limits', async () => {
    const instance = createApiInstance();
    mockAxios.onGet('/test').reply(500);
    
    try {
      await instance.get('/test');
    } catch (error) {
      expect(mockAxios.history.get.length).toBeLessThanOrEqual(API_CONFIG.RETRY_ATTEMPTS + 1);
    }
  });

  test('should not retry on certain status codes', async () => {
    const instance = createApiInstance();
    mockAxios.onGet('/test').reply(400);
    
    try {
      await instance.get('/test');
    } catch (error) {
      expect(mockAxios.history.get.length).toBe(1);
    }
  });

  test('should maintain security headers during retry', async () => {
    const instance = createApiInstance();
    const mockToken = 'mock-jwt-token';
    mockLocalStorage.getItem.mockReturnValue(mockToken);
    
    mockAxios.onGet('/test').replyOnce(500).onGet('/test').reply(200, {});
    
    try {
      await instance.get('/test');
      const requests = mockAxios.history.get;
      requests.forEach(request => {
        expect(request.headers.Authorization).toBe(`Bearer ${mockToken}`);
      });
    } catch (error) {
      // Test should not reach here
      expect(true).toBe(false);
    }
  });

  test('should handle circuit breaker interaction', async () => {
    const instance = createApiInstance({ useCircuitBreaker: true });
    mockAxios.onGet('/test').reply(500);
    
    const attempts = API_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD + 1;
    const promises = Array(attempts).fill(null).map(() => instance.get('/test').catch(() => {}));
    
    await Promise.all(promises);
    
    // Circuit should be open after threshold failures
    try {
      await instance.get('/test');
    } catch (error) {
      expect(error.message).toContain('Circuit breaker is open');
    }
  });
});