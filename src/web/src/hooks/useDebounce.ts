import { useEffect, useState, useCallback, useRef } from 'react'; // ^18.2.0

/**
 * Configuration options for the useDebounce hook
 */
interface DebounceOptions {
  /** Maximum allowed delay in milliseconds */
  maxDelay?: number;
  /** Flag to enable immediate execution on first call */
  immediate?: boolean;
  /** Flag to enable development debugging */
  enableDebug?: boolean;
}

/**
 * A production-grade debounce hook that provides type-safe value updates with
 * sophisticated memory management and performance optimization.
 * 
 * @template T - Generic type parameter for value type safety
 * @param value - The value to be debounced
 * @param delay - Delay duration in milliseconds
 * @param options - Optional configuration for debounce behavior
 * @returns The debounced value of type T
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 */
const useDebounce = <T>(
  value: T,
  delay: number,
  options: DebounceOptions = {}
): T => {
  // Validate input parameters
  if (delay < 0) {
    throw new Error('Debounce delay must be non-negative');
  }

  if (options.maxDelay && options.maxDelay < delay) {
    throw new Error('maxDelay must be greater than or equal to delay');
  }

  // Initialize state with type safety
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  // Use ref for timeout to prevent memory leaks
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Track mounted state to prevent updates after unmount
  const mountedRef = useRef<boolean>(true);

  // Development debugging support
  const debugLog = useCallback((message: string) => {
    if (options.enableDebug && process.env.NODE_ENV === 'development') {
      console.debug(`[useDebounce] ${message}`, {
        value,
        delay,
        options,
      });
    }
  }, [options.enableDebug, value, delay]);

  // Memoized update handler for performance
  const handleUpdate = useCallback(() => {
    debugLog('Updating debounced value');
    
    if (mountedRef.current) {
      setDebouncedValue(value);
    }
  }, [value, debugLog]);

  useEffect(() => {
    debugLog('Value changed, setting up debounce');

    // Handle immediate execution if enabled
    if (options.immediate && timeoutRef.current === undefined) {
      debugLog('Immediate execution triggered');
      handleUpdate();
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      debugLog('Clearing existing timeout');
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      debugLog('Timeout executed');
      handleUpdate();
    }, Math.min(delay, options.maxDelay ?? Infinity));

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        debugLog('Cleaning up timeout');
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, options.immediate, options.maxDelay, handleUpdate, debugLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        debugLog('Component unmounting, cleaning up');
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debugLog]);

  return debouncedValue;
};

export default useDebounce;