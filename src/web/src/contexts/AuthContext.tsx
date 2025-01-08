/**
 * Enterprise-grade authentication context provider implementing OAuth 2.0 + OIDC.
 * Provides secure token management, role-based access control, and comprehensive error handling.
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'; // v18.2.0
import { AuthState, LoginCredentials } from '../types/auth';
import AuthService from '../services/auth';

// Constants for token refresh and retry logic
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

// Create context with strict null checking
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
  const authService = useMemo(() => AuthService, []);

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
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
          }));
          throw error;
        }
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount))
        );
      }
    }
  }, [authService]);

  /**
   * Secure logout implementation with state cleanup
   */
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
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
    if (!state.isAuthenticated || !state.tokens) return;

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const tokens = await authService.refreshAuthToken();
      const user = await authService.getCurrentUserProfile();
      
      if (!tokens || !user) {
        throw new Error('Token refresh failed');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        tokens,
        user,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      }));
      // Force logout on token refresh failure
      await logout();
    }
  }, [state.isAuthenticated, state.tokens, authService, logout]);

  /**
   * Error clearing functionality
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Set up secure token refresh interval with cleanup
   */
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const refreshInterval = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);
    return () => clearInterval(refreshInterval);
  }, [state.isAuthenticated, refreshToken]);

  /**
   * Initialize authentication state on mount
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const tokens = await authService.validateTokens();
        if (tokens) {
          const user = await authService.getCurrentUserProfile();
          setState({
            isAuthenticated: true,
            isLoading: false,
            user,
            tokens,
            error: null,
          });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          tokens: null,
          error: error instanceof Error ? error.message : 'Authentication initialization failed',
        });
      }
    };

    initializeAuth();
  }, [authService]);

  // Memoize context value for performance optimization
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