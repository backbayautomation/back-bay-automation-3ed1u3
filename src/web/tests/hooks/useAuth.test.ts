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

// Mock initial authentication state
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
  password: 'Password123!'
};

// Mock authentication tokens
const mockTokens = {
  accessToken: 'mock.access.token',
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
    name: 'Test Organization'
  }
};

/**
 * Creates a mock authentication context wrapper with configurable state and handlers
 */
const createAuthWrapper = (
  initialState: Partial<AuthState> = {},
  mockHandlers: Partial<Record<'login' | 'logout' | 'refreshToken' | 'clearError', jest.Mock>> = {}
): React.FC => {
  const defaultState: AuthState = {
    ...mockAuthState,
    ...initialState
  };

  return ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider
      value={{
        state: defaultState,
        login: mockHandlers.login || jest.fn(),
        logout: mockHandlers.logout || jest.fn(),
        refreshToken: mockHandlers.refreshToken || jest.fn(),
        clearError: mockHandlers.clearError || jest.fn()
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

describe('useAuth Hook', () => {
  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error when used outside AuthContext', () => {
    // Attempt to render hook without context
    const { result } = renderHook(() => useAuth());

    // Verify error is thrown with correct message
    expect(result.error).toEqual(
      new Error('useAuth hook must be used within an AuthProvider component. Please ensure your component is wrapped with AuthProvider.')
    );
  });

  it('should return current authentication state', () => {
    // Create wrapper with mock state
    const wrapper = createAuthWrapper({
      isAuthenticated: true,
      user: mockUserProfile,
      tokens: mockTokens
    });

    // Render hook with wrapper
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Verify state is returned correctly
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUserProfile);
    expect(result.current.tokens).toEqual(mockTokens);
  });

  it('should handle successful login flow', async () => {
    // Create mock login handler
    const mockLogin = jest.fn().mockResolvedValue({
      user: mockUserProfile,
      tokens: mockTokens
    });

    // Create wrapper with mock handlers
    const wrapper = createAuthWrapper({}, { login: mockLogin });

    // Render hook with wrapper
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt login
    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    // Verify login was called with correct credentials
    expect(mockLogin).toHaveBeenCalledWith(mockLoginCredentials);
  });

  it('should handle login failure', async () => {
    // Create mock login handler that throws error
    const mockError = new Error('Invalid credentials');
    const mockLogin = jest.fn().mockRejectedValue(mockError);

    // Create wrapper with mock handlers
    const wrapper = createAuthWrapper({}, { login: mockLogin });

    // Render hook with wrapper
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt login and verify error handling
    await expect(
      act(async () => {
        await result.current.login(mockLoginCredentials);
      })
    ).rejects.toThrow(mockError);
  });

  it('should handle logout flow', async () => {
    // Create mock logout handler
    const mockLogout = jest.fn().mockResolvedValue(undefined);

    // Create wrapper with mock handlers
    const wrapper = createAuthWrapper(
      { isAuthenticated: true, user: mockUserProfile },
      { logout: mockLogout }
    );

    // Render hook with wrapper
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt logout
    await act(async () => {
      await result.current.logout();
    });

    // Verify logout was called
    expect(mockLogout).toHaveBeenCalled();
  });

  it('should handle token refresh', async () => {
    // Create mock refresh handler
    const mockRefresh = jest.fn().mockResolvedValue({
      ...mockTokens,
      accessToken: 'new.access.token'
    });

    // Create wrapper with mock handlers
    const wrapper = createAuthWrapper(
      { isAuthenticated: true, tokens: mockTokens },
      { refreshToken: mockRefresh }
    );

    // Render hook with wrapper
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt token refresh
    await act(async () => {
      await result.current.refreshToken();
    });

    // Verify refresh was called
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should handle error clearing', () => {
    // Create mock clear error handler
    const mockClearError = jest.fn();

    // Create wrapper with mock handlers and error state
    const wrapper = createAuthWrapper(
      { error: 'Test error' },
      { clearError: mockClearError }
    );

    // Render hook with wrapper
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt to clear error
    act(() => {
      result.current.clearError();
    });

    // Verify clear error was called
    expect(mockClearError).toHaveBeenCalled();
  });

  it('should handle loading states', async () => {
    // Create mock login handler with delay
    const mockLogin = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    // Create wrapper with mock handlers
    const wrapper = createAuthWrapper({ isLoading: true }, { login: mockLogin });

    // Render hook with wrapper
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Verify initial loading state
    expect(result.current.isLoading).toBe(true);

    // Attempt login
    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    // Verify loading state after login
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});