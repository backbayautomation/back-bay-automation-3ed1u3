/**
 * Custom React hook for type-safe localStorage management with encryption, compression,
 * and cross-tab synchronization support.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react'; // v18.2.0
import { setLocalStorage, getLocalStorage } from '../utils/storage';
import type { ApiResponse } from '../types/common';

/**
 * Options for configuring storage behavior
 */
interface StorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  expiresIn?: number;
  syncTabs?: boolean;
}

/**
 * Custom hook for managing localStorage with React state synchronization
 * @param key - Storage key
 * @param initialValue - Initial value of type T
 * @param options - Storage configuration options
 * @returns Tuple containing [value, setter, remove, loading, error]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: StorageOptions = {}
): [T, (value: T) => Promise<void>, () => Promise<void>, boolean, string | null] {
  // Initialize state with loading and error handling
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load value from storage on mount
  useEffect(() => {
    const loadStoredValue = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = getLocalStorage<T>(key);
        
        if (response.success && response.data !== null) {
          setValue(response.data);
        } else if (!response.success) {
          setError(response.error || 'Failed to load stored value');
          // Fallback to initial value on error
          setValue(initialValue);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setValue(initialValue);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredValue();
  }, [key, initialValue]);

  // Memoized setter function with storage update
  const updateValue = useCallback(async (newValue: T): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response: ApiResponse<void> = setLocalStorage(key, newValue, {
        encrypt: options.encrypt,
        compress: options.compress,
        expiresIn: options.expiresIn
      });

      if (response.success) {
        setValue(newValue);
      } else {
        setError(response.error || 'Failed to update stored value');
        throw new Error(response.error || 'Storage update failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [key, options]);

  // Memoized remove function
  const removeValue = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response: ApiResponse<void> = setLocalStorage(key, null, {
        expiresIn: 0 // Immediate expiration
      });

      if (response.success) {
        setValue(initialValue);
      } else {
        setError(response.error || 'Failed to remove stored value');
        throw new Error(response.error || 'Storage removal failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [key, initialValue]);

  // Set up storage event listener for cross-tab synchronization
  useEffect(() => {
    if (!options.syncTabs) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const response = getLocalStorage<T>(key);
          if (response.success && response.data !== null) {
            setValue(response.data);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Sync error occurred');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, options.syncTabs]);

  return [value, updateValue, removeValue, isLoading, error];
}

export default useLocalStorage;