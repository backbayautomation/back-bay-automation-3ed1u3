/**
 * Custom React hook for type-safe localStorage management with encryption,
 * state synchronization, and comprehensive error handling.
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

    // Load value from localStorage on mount
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
                setError(err instanceof Error ? err.message : 'Unknown error');
                setValue(initialValue);
            } finally {
                setIsLoading(false);
            }
        };

        loadStoredValue();
    }, [key, initialValue]);

    // Create memoized setter function
    const setStoredValue = useCallback(async (newValue: T): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            const response = setLocalStorage<T>(key, newValue, options);

            if (response.success) {
                setValue(newValue);
            } else {
                setError(response.error || 'Failed to store value');
                throw new Error(response.error || 'Failed to store value');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [key, options]);

    // Create memoized remove function
    const removeStoredValue = useCallback(async (): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            const response = setLocalStorage<null>(key, null, options);

            if (response.success) {
                setValue(initialValue);
            } else {
                setError(response.error || 'Failed to remove value');
                throw new Error(response.error || 'Failed to remove value');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [key, initialValue, options]);

    // Set up storage event listener for cross-tab synchronization
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key && event.key.endsWith(key)) {
                try {
                    if (event.newValue === null) {
                        setValue(initialValue);
                        return;
                    }

                    const response = getLocalStorage<T>(key);
                    
                    if (response.success && response.data !== null) {
                        setValue(response.data);
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [key, initialValue]);

    return [value, setStoredValue, removeStoredValue, isLoading, error];
}

export default useLocalStorage;