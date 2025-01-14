import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import axios from 'axios'; // v1.5.0
import MockAdapter from 'axios-mock-adapter'; // v1.21.0
import { createApiInstance, handleApiError } from '../../src/utils/api';
import { API_CONFIG } from '../../src/config/api';

// Mock axios for testing
const mockAxios = new MockAdapter(axios);

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('createApiInstance', () => {
  beforeEach(() => {
    mockAxios.reset();
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  test('should create instance with default security configuration', () => {
    const instance = createApiInstance();
    expect(instance.defaults.baseURL).toBe(API_CONFIG.BASE_URL);
    expect(instance.defaults.timeout).toBe(API_CONFIG.TIMEOUT);
    expect(instance.defaults.headers['Content-Type']).toBe('application/json');
    expect(instance.defaults.headers['Accept']).toBe('application/json');
  });

  test('should respect custom timeout and retry settings', () => {
    const customTimeout = 5000;
    const instance = createApiInstance({ customTimeout });
    expect(instance.defaults.timeout).toBe(customTimeout);
  });

  test('should configure circuit breaker thresholds correctly', async () => {
    const instance = createApiInstance({ useCircuitBreaker: true });
    mockAxios.onGet('/test').reply(500);

    // Trigger multiple failures to open circuit breaker
    for (let i = 0; i < 5; i++) {
      try {
        await instance.get('/test');
      } catch (error) {
        // Expected error
      }
    }

    // Next request should fail with circuit breaker error
    try {
      await instance.get('/test');
      fail('Should have thrown circuit breaker error');
    } catch (error: any) {
      expect(error.message).toBe('Circuit breaker is open');
    }
  });

  test('should implement secure header management', async () => {
    const token = 'test-token';
    mockLocalStorage.setItem('access_token', token);
    const instance = createApiInstance();

    mockAxios.onGet('/test').reply(config => {
      expect(config.headers?.Authorization).toBe(`Bearer ${token}`);
      expect(config.headers?.['X-Request-ID']).toBeDefined();
      return [200, { success: true }];
    });

    await instance.get('/test');
  });

  test('should validate SSL/TLS configuration', () => {
    const instance = createApiInstance();
    expect(instance.defaults.httpsAgent).toBeUndefined(); // Uses Node.js default HTTPS agent
  });
});

describe('handleApiError', () => {
  test('should handle network errors with retry logic', async () => {
    const networkError = new axios.AxiosError(
      'Network Error',
      'ECONNABORTED',
      { headers: {} },
      {},
      undefined
    );

    const errorResponse = await handleApiError(networkError);
    expect(errorResponse.errorType).toBe('network');
    expect(errorResponse.code).toBe('NETWORK_ERROR');
    expect(errorResponse.requestId).toBeDefined();
  });

  test('should manage authentication errors securely', async () => {
    const authError = new axios.AxiosError(
      'Unauthorized',
      '401',
      { headers: {} },
      {},
      { status: 401, data: {} } as any
    );

    mockLocalStorage.setItem('refresh_token', 'test-refresh-token');
    mockAxios.onPost(`${API_CONFIG.BASE_URL}/auth/refresh`).reply(200, {
      success: true,
      data: { accessToken: 'new-token' }
    });

    const errorResponse = await handleApiError(authError);
    expect(errorResponse.errorType).toBe('auth');
    expect(errorResponse.code).toBe('AUTH_ERROR');
  });

  test('should process validation errors with details', async () => {
    const validationError = new axios.AxiosError(
      'Validation Error',
      '400',
      { headers: {} },
      {},
      { status: 400, data: { fields: ['name'] } } as any
    );

    const errorResponse = await handleApiError(validationError);
    expect(errorResponse.errorType).toBe('validation');
    expect(errorResponse.code).toBe('VALIDATION_ERROR');
    expect(errorResponse.details).toBeDefined();
  });

  test('should trigger circuit breaker on threshold', async () => {
    const instance = createApiInstance({ useCircuitBreaker: true });
    mockAxios.onGet('/test').reply(500);

    const attempts = 6;
    const errors = [];

    for (let i = 0; i < attempts; i++) {
      try {
        await instance.get('/test');
      } catch (error) {
        errors.push(error);
      }
    }

    expect(errors).toHaveLength(attempts);
    expect(errors[attempts - 1].message).toBe('Circuit breaker is open');
  });

  test('should implement secure error logging', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const serverError = new axios.AxiosError(
      'Server Error',
      '500',
      { headers: {} },
      {},
      { status: 500, data: { sensitive: 'data' } } as any
    );

    const errorResponse = await handleApiError(serverError);
    expect(errorResponse.errorType).toBe('server');
    expect(errorResponse.details).not.toContain('sensitive');
    consoleSpy.mockRestore();
  });
});

describe('retryRequest', () => {
  test('should implement exponential backoff correctly', async () => {
    const instance = createApiInstance();
    const requestTimes: number[] = [];
    mockAxios.onGet('/test').reply(config => {
      requestTimes.push(Date.now());
      return [500, {}];
    });

    try {
      await instance.get('/test');
    } catch (error) {
      // Expected error
    }

    const intervals = requestTimes.slice(1).map((time, index) => 
      time - requestTimes[index]
    );

    intervals.forEach((interval, index) => {
      const minExpectedDelay = Math.pow(2, index) * 1000;
      expect(interval).toBeGreaterThanOrEqual(minExpectedDelay);
    });
  });

  test('should respect retry attempt thresholds', async () => {
    const instance = createApiInstance();
    let attempts = 0;
    mockAxios.onGet('/test').reply(() => {
      attempts++;
      return [500, {}];
    });

    try {
      await instance.get('/test');
    } catch (error) {
      // Expected error
    }

    expect(attempts).toBeLessThanOrEqual(API_CONFIG.RETRY_ATTEMPTS + 1);
  });

  test('should maintain security headers during retry', async () => {
    const instance = createApiInstance();
    const token = 'test-token';
    mockLocalStorage.setItem('access_token', token);
    
    let requestHeaders: any[] = [];
    mockAxios.onGet('/test').reply(config => {
      requestHeaders.push(config.headers);
      return [500, {}];
    });

    try {
      await instance.get('/test');
    } catch (error) {
      // Expected error
    }

    requestHeaders.forEach(headers => {
      expect(headers.Authorization).toBe(`Bearer ${token}`);
      expect(headers['X-Request-ID']).toBeDefined();
    });
  });

  test('should validate retry status patterns', async () => {
    const instance = createApiInstance();
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    const nonRetryableStatuses = [400, 401, 403, 404];

    for (const status of retryableStatuses) {
      let attempts = 0;
      mockAxios.onGet(`/test-${status}`).reply(() => {
        attempts++;
        return [status, {}];
      });

      try {
        await instance.get(`/test-${status}`);
      } catch (error) {
        // Expected error
      }

      expect(attempts).toBeGreaterThan(1);
    }

    for (const status of nonRetryableStatuses) {
      let attempts = 0;
      mockAxios.onGet(`/test-${status}`).reply(() => {
        attempts++;
        return [status, {}];
      });

      try {
        await instance.get(`/test-${status}`);
      } catch (error) {
        // Expected error
      }

      expect(attempts).toBe(1);
    }
  });
});