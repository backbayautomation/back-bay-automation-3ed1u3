/**
 * Custom React hook for type-safe localStorage management with encryption and state synchronization.
 * Provides secure client-side storage with automatic JSON serialization and error handling.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react'; // v18.2.0
import { setLocalStorage, getLocalStorage, StorageOptions } from '../utils/storage';
import { ApiResponse } from '../types/common';

/**
 * Hook return type with strongly typed value and operations
 */
type UseLocalStorageReturn<T> = [
  T, // Current value
  (value: T) => Promise<void>, // Setter function
  () => Promise<void>, // Remove function
  boolean, // Loading state
  string | null // Error message
];

/**
 * Custom hook for managing localStorage values with React state synchronization
 * @param key - Storage key
 * @param initialValue - Initial value of type T
 * @param options - Storage options for encryption and compression
 * @returns Tuple containing value, setter, remove function, loading state, and error
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: StorageOptions = {}
): UseLocalStorageReturn<T> {
  // Initialize state with loading and error handling
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load value from localStorage on mount and handle storage events
   */
  useEffect(() => {
    const loadValue = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = getLocalStorage<T>(key);
        if (response.success && response.data !== null) {
          setValue(response.data);
        } else if (!response.success) {
          setError(response.error || 'Failed to load value');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    // Load initial value
    loadValue();

    /**
     * Handle storage events for cross-tab synchronization
     */
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && event.key.endsWith(key)) {
        loadValue();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  /**
   * Memoized setter function with error handling
   */
  const updateValue = useCallback(
    async (newValue: T): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const response: ApiResponse<void> = setLocalStorage(key, newValue, options);
        
        if (response.success) {
          setValue(newValue);
        } else {
          setError(response.error || 'Failed to update value');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [key, options]
  );

  /**
   * Memoized remove function with cleanup
   */
  const removeValue = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = setLocalStorage<null>(key, null, options);
      
      if (response.success) {
        setValue(initialValue);
      } else {
        setError(response.error || 'Failed to remove value');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [key, initialValue, options]);

  return [value, updateValue, removeValue, isLoading, error];
}

export default useLocalStorage;