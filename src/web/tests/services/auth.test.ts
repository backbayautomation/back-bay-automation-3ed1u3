import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import { AuthService } from '../../src/services/auth';
import { LoginCredentials, AuthTokens, UserProfile, UserRole } from '../../src/types/auth';
import * as crypto from 'crypto';

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
    })
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

const mockUserProfile: UserProfile = {
  id: 'user-123' as any,
  email: 'test@example.com' as any,
  fullName: 'Test User',
  role: UserRole.REGULAR_USER,
  isActive: true,
  orgId: 'org-123',
  clientId: 'client-123',
  organization: {
    id: 'org-123',
    name: 'Test Org'
  }
};

const mockAuthTokens: AuthTokens = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  expiresIn: 3600,
  tokenType: 'Bearer'
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
  });

  describe('User Authentication', () => {
    test('should authenticate user with valid credentials and MFA', async () => {
      // Mock successful authentication response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUserProfile, tokens: mockAuthTokens })
      });

      const result = await authService.authenticateUser(mockLoginCredentials);

      expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockLoginCredentials)
      });

      expect(result).toEqual({
        user: mockUserProfile,
        tokens: mockAuthTokens
      });

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('should handle authentication failure with invalid credentials', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(authService.authenticateUser(mockLoginCredentials))
        .rejects.toThrow('Authentication failed');
    });

    test('should enforce rate limiting on authentication attempts', async () => {
      const attempts = 6;
      for (let i = 0; i < attempts; i++) {
        if (i < 5) {
          fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 401
          });
        }
        try {
          await authService.authenticateUser(mockLoginCredentials);
        } catch (error) {
          if (i === 5) {
            expect(error.message).toContain('Too many authentication attempts');
          }
        }
      }
    });
  });

  describe('Token Management', () => {
    test('should securely refresh tokens', async () => {
      // Setup initial tokens
      const initialTokens = { ...mockAuthTokens };
      localStorage.setItem('auth_tokens_encrypted', JSON.stringify(initialTokens));

      // Mock successful token refresh
      const newTokens = { ...mockAuthTokens, accessToken: 'new.access.token' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newTokens)
      });

      const result = await authService.secureTokenRefresh();

      expect(result).toEqual(newTokens);
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('should validate token integrity', () => {
      const validToken = {
        ...mockAuthTokens,
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmV4YW1wbGUuY29tIiwiZXhwIjoxNzA3NzM4NDAwfQ.signature'
      };

      process.env.REACT_APP_AUTH_ISSUER = 'https://auth.example.com';

      const isValid = authService.validateTokenIntegrity(validToken);
      expect(isValid).toBe(true);
    });

    test('should handle token refresh failure with retry', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockAuthTokens)
        });

      const result = await authService.secureTokenRefresh();
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockAuthTokens);
    });
  });

  describe('Logout Security', () => {
    test('should securely clear auth state on logout', async () => {
      // Setup initial auth state
      localStorage.setItem('auth_tokens_encrypted', JSON.stringify(mockAuthTokens));

      fetchMock.mockResolvedValueOnce({
        ok: true
      });

      await authService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_tokens_encrypted');
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockAuthTokens.accessToken}`
        }
      });
    });

    test('should handle logout API failure gracefully', async () => {
      localStorage.setItem('auth_tokens_encrypted', JSON.stringify(mockAuthTokens));

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await authService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_tokens_encrypted');
    });
  });

  describe('User Profile Security', () => {
    test('should securely retrieve current user profile', async () => {
      // Setup authenticated state
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUserProfile, tokens: mockAuthTokens })
      });

      await authService.authenticateUser(mockLoginCredentials);
      const currentUser = authService.getCurrentUser();

      expect(currentUser).toEqual(mockUserProfile);
    });

    test('should validate user roles correctly', async () => {
      // Setup authenticated state with admin user
      const adminProfile = { ...mockUserProfile, role: UserRole.SYSTEM_ADMIN };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: adminProfile, tokens: mockAuthTokens })
      });

      await authService.authenticateUser(mockLoginCredentials);

      expect(authService.hasRole(UserRole.SYSTEM_ADMIN)).toBe(true);
      expect(authService.hasRole(UserRole.REGULAR_USER)).toBe(false);
    });
  });
});