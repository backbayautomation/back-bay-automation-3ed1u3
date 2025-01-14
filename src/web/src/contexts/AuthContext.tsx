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
const RETRY_DELAY = 1000; // 1 second in milliseconds

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
    error: null
  });

  // Create memoized instance of AuthService
  const authService = useMemo(() => new AuthService(), []);

  /**
   * Secure login implementation with retry mechanism
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    let attempt = 0;
    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        const { user, tokens } = await authService.authenticateUser(credentials);
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
          tokens,
          error: null
        });
        return;
      } catch (error) {
        attempt++;
        if (attempt === MAX_RETRY_ATTEMPTS) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Authentication failed'
          }));
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }, [authService]);

  /**
   * Secure logout with state cleanup
   */
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        tokens: null,
        error: null
      });
    }
  }, [authService]);

  /**
   * Token refresh with comprehensive error handling
   */
  const refreshToken = useCallback(async () => {
    try {
      const newTokens = await authService.secureTokenRefresh();
      setState(prev => ({
        ...prev,
        tokens: newTokens,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      }));
      throw error;
    }
  }, [authService]);

  /**
   * Clear authentication errors
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Set up automatic token refresh with cleanup
   */
  useEffect(() => {
    if (state.isAuthenticated) {
      const refreshInterval = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);
      return () => clearInterval(refreshInterval);
    }
  }, [state.isAuthenticated, refreshToken]);

  /**
   * Initialize authentication state on mount
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const user = authService.getCurrentUser();
          const tokens = await authService.secureTokenRefresh();
          setState({
            isAuthenticated: true,
            isLoading: false,
            user,
            tokens,
            error: null
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
          error: error instanceof Error ? error.message : 'Authentication initialization failed'
        });
      }
    };

    initializeAuth();
  }, [authService]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    state,
    login,
    logout,
    refreshToken,
    clearError
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