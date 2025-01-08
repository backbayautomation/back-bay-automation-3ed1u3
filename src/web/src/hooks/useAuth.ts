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
interface UseAuthReturn {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthState['user'];
  tokens: AuthState['tokens'];
  error: AuthState['error'];

  // Authentication methods
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook providing secure access to authentication context and functionality
 * with comprehensive error handling and type safety.
 * 
 * @returns {UseAuthReturn} Strongly-typed authentication state and methods
 * @throws {Error} If used outside of AuthProvider context
 */
export const useAuth = (): UseAuthReturn => {
  // Get authentication context with type safety
  const context = useContext(AuthContext);

  // Validate context existence with detailed error
  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Ensure your component is wrapped in the AuthProvider component.'
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

    // Authentication methods with proper typing
    login,
    logout,
    refreshToken,
    clearError
  };
};

/**
 * Default export of useAuth hook for convenient importing
 */
export default useAuth;