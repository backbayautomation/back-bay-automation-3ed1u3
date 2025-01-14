/**
 * Comprehensive test suite for useAuth hook validating authentication functionality,
 * context integration, secure token management, and type safety.
 * @version 1.0.0
 */

import React from 'react'; // v18.2.0
import { renderHook, act, waitFor } from '@testing-library/react-hooks'; // v8.0.1
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.7.0

import { useAuth } from '../../src/hooks/useAuth';
import { AuthContext } from '../../src/contexts/AuthContext';
import type { AuthState } from '../../src/types/auth';

/**
 * Creates a complete mock authentication state with configurable properties
 */
const createMockAuthState = (overrides: Partial<AuthState> = {}): AuthState => ({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  tokens: null,
  error: null,
  mfaRequired: false,
  ...overrides
});

/**
 * Mock authentication context wrapper with configurable initial state and handlers
 */
const mockAuthContext = (
  initialState: AuthState = createMockAuthState(),
  mockHandlers: Record<string, jest.Mock> = {}
) => {
  const defaultHandlers = {
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    clearError: jest.fn()
  };

  const handlers = { ...defaultHandlers, ...mockHandlers };

  return ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider
      value={{
        state: initialState,
        ...handlers
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
      new Error(
        'useAuth must be used within an AuthProvider. ' +
        'Please ensure your component is wrapped in the AuthProvider component.'
      )
    );
  });

  it('should provide authentication state and methods when wrapped in AuthContext', () => {
    const mockState = createMockAuthState();
    const mockLogin = jest.fn();
    const mockLogout = jest.fn();
    const mockRefreshToken = jest.fn();

    const wrapper = mockAuthContext(mockState, {
      login: mockLogin,
      logout: mockLogout,
      refreshToken: mockRefreshToken
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toEqual({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      tokens: null,
      login: mockLogin,
      logout: mockLogout,
      refreshToken: mockRefreshToken
    });
  });

  it('should handle successful authentication flow', async () => {
    const mockLogin = jest.fn().mockResolvedValue(undefined);
    const mockTokens = {
      accessToken: 'mock.jwt.token',
      refreshToken: 'mock.refresh.token',
      expiresIn: 3600,
      tokenType: 'Bearer'
    };

    const wrapper = mockAuthContext(
      createMockAuthState(),
      { login: mockLogin }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });

  it('should handle MFA authentication flow', async () => {
    const mockState = createMockAuthState({ mfaRequired: true });
    const mockLogin = jest.fn().mockResolvedValue(undefined);

    const wrapper = mockAuthContext(mockState, { login: mockLogin });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
        mfaToken: '123456'
      });
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      mfaToken: '123456'
    });
  });

  it('should handle logout flow', async () => {
    const mockLogout = jest.fn().mockResolvedValue(undefined);
    const mockState = createMockAuthState({ isAuthenticated: true });

    const wrapper = mockAuthContext(mockState, { logout: mockLogout });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  it('should handle token refresh flow', async () => {
    const mockRefreshToken = jest.fn().mockResolvedValue({
      accessToken: 'new.jwt.token',
      refreshToken: 'new.refresh.token',
      expiresIn: 3600,
      tokenType: 'Bearer'
    });

    const wrapper = mockAuthContext(
      createMockAuthState({ isAuthenticated: true }),
      { refreshToken: mockRefreshToken }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(mockRefreshToken).toHaveBeenCalled();
  });

  it('should reflect loading state during authentication', async () => {
    const mockLogin = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    const wrapper = mockAuthContext(
      createMockAuthState(),
      { login: mockLogin }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    const loginPromise = act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    expect(result.current.isLoading).toBe(true);
    await loginPromise;
  });

  it('should handle authentication errors', async () => {
    const mockError = new Error('Invalid credentials');
    const mockLogin = jest.fn().mockRejectedValue(mockError);

    const wrapper = mockAuthContext(
      createMockAuthState(),
      { login: mockLogin }
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login({
          email: 'test@example.com',
          password: 'wrong_password'
        });
      } catch (error) {
        expect(error).toBe(mockError);
      }
    });
  });
});