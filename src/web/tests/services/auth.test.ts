import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import { AuthService } from '../../src/services/auth';
import { LoginCredentials, AuthTokens, UserProfile, UserRole } from '../../src/types/auth';
import crypto from 'crypto';

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: jest.fn((key: string) => store[key]),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch API
global.fetch = jest.fn();

// Test constants
const mockLoginCredentials: LoginCredentials = {
  email: 'test@example.com',
  password: 'password123',
  mfaToken: '123456'
};

const mockAuthTokens: AuthTokens = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  expiresIn: 3600,
  tokenType: 'Bearer',
  tokenIntegrity: 'sha256-hash'
};

const mockUserProfile: UserProfile = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  fullName: 'Test User',
  role: UserRole.REGULAR_USER,
  isActive: true,
  orgId: '123e4567-e89b-12d3-a456-426614174001',
  clientId: '123e4567-e89b-12d3-a456-426614174002',
  organization: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Org'
  }
};

describe('AuthService Security Tests', () => {
  let authService: AuthService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    fetchMock = global.fetch as jest.Mock;
    authService = new AuthService();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    if (authService['refreshTimer']) {
      clearTimeout(authService['refreshTimer']);
    }
  });

  describe('User Authentication', () => {
    test('should successfully authenticate user with valid credentials and MFA', async () => {
      // Mock successful authentication response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tokens: mockAuthTokens, user: mockUserProfile })
      });

      const result = await authService.authenticateUser(mockLoginCredentials);

      expect(result).toEqual({
        user: mockUserProfile,
        tokens: mockAuthTokens
      });
      expect(localStorage.setItem).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockLoginCredentials)
      });
    });

    test('should enforce rate limiting on authentication attempts', async () => {
      // Mock failed authentication attempts
      fetchMock.mockRejectedValue(new Error('Authentication failed'));

      const attempts = 6;
      const authPromises = Array(attempts).fill(null).map(() => 
        authService.authenticateUser(mockLoginCredentials)
      );

      await expect(Promise.all(authPromises)).rejects.toThrow('Too many authentication attempts');
    });

    test('should handle authentication failure securely', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(authService.authenticateUser(mockLoginCredentials))
        .rejects.toThrow('Authentication failed');
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Token Management', () => {
    test('should securely refresh tokens before expiration', async () => {
      const newMockTokens = { ...mockAuthTokens, accessToken: 'new.access.token' };
      
      // Setup initial auth state
      authService['tokens'] = mockAuthTokens;
      authService['currentUser'] = mockUserProfile;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newMockTokens)
      });

      await authService['secureTokenRefresh']();

      expect(authService['tokens']).toEqual(newMockTokens);
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('should validate token integrity', () => {
      const validTokens = {
        ...mockAuthTokens,
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNzA3NzY1NDAwfQ.mock',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNzA3NzY1NDAwfQ.mock'
      };

      const result = authService['validateTokenIntegrity'](validTokens);
      expect(result).toBe(true);
    });

    test('should detect invalid token integrity', () => {
      const invalidTokens = {
        ...mockAuthTokens,
        accessToken: 'invalid.token',
        refreshToken: 'invalid.refresh.token'
      };

      const result = authService['validateTokenIntegrity'](invalidTokens);
      expect(result).toBe(false);
    });
  });

  describe('Secure Logout', () => {
    test('should securely clear authentication state on logout', async () => {
      // Setup initial auth state
      authService['tokens'] = mockAuthTokens;
      authService['currentUser'] = mockUserProfile;

      fetchMock.mockResolvedValueOnce({
        ok: true
      });

      await authService.logout();

      expect(authService['tokens']).toBeNull();
      expect(authService['currentUser']).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockAuthTokens.accessToken}`
        }
      });
    });

    test('should handle logout failure gracefully', async () => {
      authService['tokens'] = mockAuthTokens;
      authService['currentUser'] = mockUserProfile;

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await authService.logout();

      expect(authService['tokens']).toBeNull();
      expect(authService['currentUser']).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('Authentication State', () => {
    test('should maintain secure authentication state', () => {
      expect(authService.isAuthenticated()).toBe(false);

      authService['tokens'] = mockAuthTokens;
      authService['currentUser'] = mockUserProfile;

      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getCurrentUser()).toEqual(mockUserProfile);
    });

    test('should handle token expiration', async () => {
      const expiredTokens = {
        ...mockAuthTokens,
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNjA3NzY1NDAwfQ.mock',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNjA3NzY1NDAwfQ.mock'
      };

      const result = authService['validateTokenIntegrity'](expiredTokens);
      expect(result).toBe(false);
    });
  });
});