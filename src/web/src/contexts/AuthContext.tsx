/**
 * Enterprise-grade authentication context provider implementing OAuth 2.0 + OIDC.
 * Provides secure token management, role-based access control, and comprehensive error handling.
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'; // v18.2.0
import { AuthState, LoginCredentials, AuthService } from '../services/auth';

// Constants for authentication management
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // Base delay in milliseconds

/**
 * Enhanced type definition for authentication context with comprehensive error handling
 */
interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

/**
 * Create authentication context with strict null checking
 */
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Enhanced authentication provider with secure token management and error handling
 */
export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // Initialize authentication state with comprehensive error handling
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tokens: null,
    error: null,
  });

  // Create memoized instance of AuthService
  const authService = useMemo(() => new AuthService(), []);

  /**
   * Set up secure token refresh interval with cleanup
   */
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (state.isAuthenticated && state.tokens) {
      refreshInterval = setInterval(async () => {
        try {
          await authService.secureTokenRefresh();
        } catch (error) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Token refresh failed',
            isAuthenticated: false,
            tokens: null,
            user: null,
          }));
        }
      }, TOKEN_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [state.isAuthenticated, state.tokens, authService]);

  /**
   * Secure login implementation with retry mechanism
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    let retryCount = 0;

    while (retryCount < MAX_RETRY_ATTEMPTS) {
      try {
        const { user, tokens } = await authService.authenticateUser(credentials);
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
          tokens,
          error: null,
        });
        return;
      } catch (error) {
        retryCount++;
        if (retryCount === MAX_RETRY_ATTEMPTS) {
          setState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            tokens: null,
            error: error instanceof Error ? error.message : 'Authentication failed',
          });
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      }
    }
  }, [authService]);

  /**
   * Secure logout implementation with state cleanup
   */
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await authService.logout();
    } finally {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        tokens: null,
        error: null,
      });
    }
  }, [authService]);

  /**
   * Token refresh implementation with error handling
   */
  const refreshToken = useCallback(async () => {
    try {
      const newTokens = await authService.secureTokenRefresh();
      setState(prev => ({
        ...prev,
        tokens: newTokens,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Token refresh failed',
        isAuthenticated: false,
        tokens: null,
        user: null,
      }));
      throw error;
    }
  }, [authService]);

  /**
   * Error clearing functionality
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Memoized context value for performance optimization
   */
  const contextValue = useMemo(() => ({
    state,
    login,
    logout,
    refreshToken,
    clearError,
  }), [state, login, logout, refreshToken, clearError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook for accessing authentication context with type safety
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;