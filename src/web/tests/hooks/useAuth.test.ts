/**
 * Comprehensive test suite for useAuth hook validating authentication functionality,
 * context integration, and secure token management.
 * @version 1.0.0
 */

import React from 'react'; // v18.2.0
import { renderHook, act, waitFor } from '@testing-library/react-hooks'; // v8.0.1
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.7.0
import { useAuth } from '../../src/hooks/useAuth';
import { AuthContext } from '../../src/contexts/AuthContext';
import type { AuthState } from '../../src/types/auth';

// Mock initial auth state
const mockAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  tokens: null,
  error: null,
  mfaRequired: false
};

// Mock login credentials
const mockLoginCredentials = {
  email: 'test@example.com',
  password: 'password123'
};

// Mock tokens
const mockTokens = {
  accessToken: 'mock.jwt.token',
  refreshToken: 'mock.refresh.token',
  expiresIn: 3600,
  tokenType: 'Bearer'
};

// Mock user profile
const mockUserProfile = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  fullName: 'Test User',
  role: 'REGULAR_USER',
  isActive: true,
  orgId: '123e4567-e89b-12d3-a456-426614174001',
  clientId: '123e4567-e89b-12d3-a456-426614174002',
  organization: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Org'
  }
};

/**
 * Creates a mock authentication context wrapper with configurable initial state
 * and mock functions for testing
 */
const mockAuthContext = (
  initialState: Partial<AuthState> = {},
  mockHandlers: Partial<Record<string, jest.Mock>> = {}
): React.FC => {
  const defaultState: AuthState = {
    ...mockAuthState,
    ...initialState
  };

  const mockLogin = jest.fn();
  const mockLogout = jest.fn();
  const mockRefreshToken = jest.fn();
  const mockClearError = jest.fn();

  return ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider
      value={{
        state: defaultState,
        login: mockHandlers.login || mockLogin,
        logout: mockHandlers.logout || mockLogout,
        refreshToken: mockHandlers.refreshToken || mockRefreshToken,
        clearError: mockHandlers.clearError || mockClearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

describe('useAuth Hook', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error when used outside AuthContext', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.error).toEqual(
      new Error('useAuth must be used within an AuthProvider. Ensure your component is wrapped in the AuthProvider component.')
    );
  });

  it('should provide initial authentication state', () => {
    const wrapper = mockAuthContext();
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.tokens).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle successful login flow', async () => {
    const mockLoginFn = jest.fn().mockResolvedValue({
      user: mockUserProfile,
      tokens: mockTokens
    });

    const wrapper = mockAuthContext({}, { login: mockLoginFn });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    expect(mockLoginFn).toHaveBeenCalledWith(mockLoginCredentials);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUserProfile);
    expect(result.current.tokens).toEqual(mockTokens);
  });

  it('should handle login failure with proper error state', async () => {
    const mockError = new Error('Invalid credentials');
    const mockLoginFn = jest.fn().mockRejectedValue(mockError);

    const wrapper = mockAuthContext({}, { login: mockLoginFn });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login(mockLoginCredentials);
      } catch (error) {
        expect(error).toBe(mockError);
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Invalid credentials');
  });

  it('should handle logout successfully', async () => {
    const mockLogoutFn = jest.fn().mockResolvedValue(undefined);
    const wrapper = mockAuthContext(
      {
        isAuthenticated: true,
        user: mockUserProfile,
        tokens: mockTokens
      },
      { logout: mockLogoutFn }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockLogoutFn).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.tokens).toBeNull();
  });

  it('should handle token refresh successfully', async () => {
    const mockNewTokens = {
      ...mockTokens,
      accessToken: 'new.jwt.token'
    };
    const mockRefreshFn = jest.fn().mockResolvedValue(mockNewTokens);

    const wrapper = mockAuthContext(
      {
        isAuthenticated: true,
        tokens: mockTokens
      },
      { refreshToken: mockRefreshFn }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(mockRefreshFn).toHaveBeenCalled();
    expect(result.current.tokens).toEqual(mockNewTokens);
  });

  it('should handle token refresh failure', async () => {
    const mockError = new Error('Token refresh failed');
    const mockRefreshFn = jest.fn().mockRejectedValue(mockError);

    const wrapper = mockAuthContext(
      {
        isAuthenticated: true,
        tokens: mockTokens
      },
      { refreshToken: mockRefreshFn }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.refreshToken();
      } catch (error) {
        expect(error).toBe(mockError);
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.tokens).toBeNull();
    expect(result.current.error).toBe('Token refresh failed');
  });

  it('should clear error state', () => {
    const mockClearErrorFn = jest.fn();
    const wrapper = mockAuthContext(
      { error: 'Test error' },
      { clearError: mockClearErrorFn }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.clearError();
    });

    expect(mockClearErrorFn).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('should handle loading state during authentication', async () => {
    const mockLoginFn = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    const wrapper = mockAuthContext({ isLoading: true }, { login: mockLoginFn });
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    expect(result.current.isLoading).toBe(false);
  });
});