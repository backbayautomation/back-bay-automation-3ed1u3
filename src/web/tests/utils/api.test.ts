import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import axios from 'axios'; // v1.5.0
import MockAdapter from 'axios-mock-adapter'; // v1.21.0
import { createApiInstance, handleApiError } from '../../src/utils/api';
import { API_CONFIG } from '../../src/config/api';

// Mock implementations
jest.mock('../../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'https://api.test.com/v1',
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    CIRCUIT_BREAKER_OPTIONS: {
      FAILURE_THRESHOLD: 5,
      RESET_TIMEOUT: 60000,
    },
    MAX_BACKOFF_MS: 32000,
  },
}));

describe('API Utility Functions', () => {
  let mockAxios: MockAdapter;
  
  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    mockAxios.restore();
    jest.useRealTimers();
  });

  describe('createApiInstance', () => {
    test('should create instance with default security configuration', () => {
      const instance = createApiInstance();
      expect(instance.defaults.baseURL).toBe(API_CONFIG.BASE_URL);
      expect(instance.defaults.timeout).toBe(API_CONFIG.TIMEOUT);
      expect(instance.defaults.headers['Content-Type']).toBe('application/json');
      expect(instance.defaults.headers['Accept']).toBe('application/json');
    });

    test('should respect custom timeout and security headers', () => {
      const customTimeout = 5000;
      const customHeaders = {
        'X-Custom-Security': 'test-value',
        'X-API-Version': '2.0',
      };
      
      const instance = createApiInstance({
        customTimeout,
        customHeaders,
      });

      expect(instance.defaults.timeout).toBe(customTimeout);
      expect(instance.defaults.headers['X-Custom-Security']).toBe('test-value');
      expect(instance.defaults.headers['X-API-Version']).toBe('2.0');
    });

    test('should add authentication token to requests when available', async () => {
      const token = 'test-jwt-token';
      localStorage.setItem('auth_token', token);
      
      const instance = createApiInstance();
      mockAxios.onGet('/test').reply(200);
      
      await instance.get('/test');
      
      expect(mockAxios.history.get[0].headers?.Authorization).toBe(`Bearer ${token}`);
    });

    test('should skip authentication when specified', async () => {
      const token = 'test-jwt-token';
      localStorage.setItem('auth_token', token);
      
      const instance = createApiInstance({ skipAuth: true });
      mockAxios.onGet('/test').reply(200);
      
      await instance.get('/test');
      
      expect(mockAxios.history.get[0].headers?.Authorization).toBeUndefined();
    });

    test('should track request timing metadata', async () => {
      const instance = createApiInstance();
      mockAxios.onGet('/test').reply(200);
      
      const startTime = Date.now();
      await instance.get('/test');
      
      const request = mockAxios.history.get[0];
      expect(request.metadata?.startTime).toBeGreaterThanOrEqual(startTime);
    });
  });

  describe('handleApiError', () => {
    test('should handle network errors appropriately', async () => {
      const networkError = new axios.AxiosError(
        'Network Error',
        'ECONNABORTED',
        {} as any,
        {} as any,
      );

      const errorResponse = await handleApiError(networkError);
      
      expect(errorResponse.code).toBe('NETWORK_ERROR');
      expect(errorResponse.errorType).toBe('network');
      expect(errorResponse.requestId).toBeTruthy();
      expect(errorResponse.timestamp).toBeLessThanOrEqual(Date.now());
    });

    test('should handle authentication errors with token refresh attempt', async () => {
      const authError = new axios.AxiosError(
        'Unauthorized',
        '401',
        {} as any,
        {} as any,
        {
          status: 401,
          data: { message: 'Token expired' },
        } as any,
      );

      localStorage.setItem('refresh_token', 'test-refresh-token');
      const errorResponse = await handleApiError(authError);
      
      expect(errorResponse.code).toBe('AUTH_ERROR');
      expect(errorResponse.errorType).toBe('auth');
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });

    test('should handle validation errors with field details', async () => {
      const validationError = new axios.AxiosError(
        'Bad Request',
        '400',
        {} as any,
        {} as any,
        {
          status: 400,
          data: { fields: { email: 'Invalid format' } },
        } as any,
      );

      const errorResponse = await handleApiError(validationError);
      
      expect(errorResponse.code).toBe('VALIDATION_ERROR');
      expect(errorResponse.errorType).toBe('validation');
      expect(errorResponse.details).toEqual({ fields: { email: 'Invalid format' } });
    });

    test('should handle server errors with circuit breaker interaction', async () => {
      const instance = createApiInstance({ useCircuitBreaker: true });
      mockAxios.onGet('/test').reply(500);
      
      try {
        await instance.get('/test');
      } catch (error) {
        expect(error.code).toBe('SERVER_ERROR');
        expect(error.errorType).toBe('server');
      }
      
      // Verify circuit breaker state
      try {
        await instance.get('/test');
      } catch (error) {
        expect(error.code).toBe('SERVER_ERROR');
      }
    });
  });

  describe('Retry Logic', () => {
    test('should implement exponential backoff with jitter', async () => {
      const instance = createApiInstance();
      mockAxios.onGet('/test')
        .replyOnce(500)
        .replyOnce(500)
        .replyOnce(200, { data: 'success' });

      const startTime = Date.now();
      const response = await instance.get('/test');
      
      expect(response.data).toEqual({ data: 'success' });
      expect(mockAxios.history.get.length).toBe(3);
      
      // Verify exponential backoff timing
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThan(3000); // Minimum backoff time
    });

    test('should respect retry attempt limits', async () => {
      const instance = createApiInstance();
      mockAxios.onGet('/test').reply(500);

      try {
        await instance.get('/test');
      } catch (error) {
        expect(mockAxios.history.get.length).toBe(API_CONFIG.RETRY_ATTEMPTS + 1);
        expect(error.code).toBe('SERVER_ERROR');
      }
    });

    test('should not retry on certain status codes', async () => {
      const instance = createApiInstance();
      mockAxios.onGet('/test').reply(404);

      try {
        await instance.get('/test');
      } catch (error) {
        expect(mockAxios.history.get.length).toBe(1);
        expect(error.code).toBe('SERVER_ERROR');
      }
    });

    test('should handle circuit breaker state transitions', async () => {
      const instance = createApiInstance({ useCircuitBreaker: true });
      mockAxios.onGet('/test').reply(500);

      for (let i = 0; i < API_CONFIG.RETRY_ATTEMPTS + 1; i++) {
        try {
          await instance.get('/test');
        } catch (error) {
          continue;
        }
      }

      try {
        await instance.get('/test');
      } catch (error) {
        expect(error.code).toBe('SERVER_ERROR');
        expect(mockAxios.history.get.length).toBe(API_CONFIG.RETRY_ATTEMPTS + 2);
      }
    });

    test('should maintain security headers during retries', async () => {
      const instance = createApiInstance({
        customHeaders: {
          'X-Security-Token': 'test-token',
        },
      });

      mockAxios.onGet('/test')
        .replyOnce(500)
        .replyOnce(200, { data: 'success' });

      await instance.get('/test');

      mockAxios.history.get.forEach(request => {
        expect(request.headers['X-Security-Token']).toBe('test-token');
      });
    });
  });
});