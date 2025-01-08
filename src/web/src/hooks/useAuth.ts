/**
 * Enterprise-grade authentication hook providing secure authentication state management
 * and token handling through AuthContext. Implements OAuth 2.0 + JWT authentication
 * with comprehensive error handling and type safety.
 * @version 1.0.0
 */

import { useContext } from 'react'; // v18.2.0
import AuthContext from '../contexts/AuthContext';
import type { AuthState } from '../types/auth';

/**
 * Return type for useAuth hook with comprehensive authentication functionality
 */
interface UseAuthReturn extends AuthState {
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook providing secure authentication functionality with proper error handling
 * and type safety. Implements OAuth 2.0 + JWT authentication with token refresh.
 * 
 * @throws {Error} When used outside of AuthProvider context
 * @returns {UseAuthReturn} Authentication state and methods with type safety
 */
export const useAuth = (): UseAuthReturn => {
  // Get authentication context with type safety
  const context = useContext(AuthContext);

  // Validate context existence with detailed error message
  if (!context) {
    throw new Error(
      'useAuth hook must be used within an AuthProvider component. ' +
      'Please ensure your component is wrapped with AuthProvider.'
    );
  }

  // Destructure context with type safety
  const {
    state: {
      isAuthenticated,
      isLoading,
      user,
      tokens,
      error
    },
    login,
    logout,
    refreshToken,
    clearError
  } = context;

  // Return strongly-typed authentication state and methods
  return {
    // Authentication state
    isAuthenticated,
    isLoading,
    user,
    tokens,
    error,

    // Authentication methods with proper error handling
    login: async (credentials) => {
      try {
        await login(credentials);
      } catch (error) {
        // Let error propagate to be handled by error boundary
        throw error;
      }
    },

    logout: async () => {
      try {
        await logout();
      } catch (error) {
        // Let error propagate to be handled by error boundary
        throw error;
      }
    },

    refreshToken: async () => {
      try {
        await refreshToken();
      } catch (error) {
        // Let error propagate to be handled by error boundary
        throw error;
      }
    },

    // Error handling
    clearError
  };
};

export default useAuth;