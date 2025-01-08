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
 * A production-grade hook that provides debounced value updates with enhanced type safety,
 * memory leak prevention, and performance optimization.
 * 
 * @template T - Generic type parameter for value type safety
 * @param {T} value - The value to be debounced
 * @param {number} delay - Delay in milliseconds
 * @param {DebounceOptions} options - Optional configuration parameters
 * @returns {T} The debounced value
 * 
 * @example
 * const debouncedValue = useDebounce(searchTerm, 300, { maxDelay: 1000 });
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
  
  // Debug logging ref to track updates
  const updateCountRef = useRef<number>(0);

  // Memoized debug logger
  const logDebug = useCallback((message: string) => {
    if (options.enableDebug) {
      console.debug(
        `[useDebounce] ${message}`,
        {
          value,
          delay,
          updateCount: updateCountRef.current,
          timestamp: new Date().toISOString()
        }
      );
    }
  }, [options.enableDebug]);

  // Memoized debounce handler for performance
  const debouncedSetValue = useCallback(() => {
    updateCountRef.current += 1;
    logDebug('Updating debounced value');
    setDebouncedValue(value);
  }, [value, logDebug]);

  useEffect(() => {
    // Handle immediate execution if enabled
    if (options.immediate && updateCountRef.current === 0) {
      logDebug('Immediate execution');
      debouncedSetValue();
      return;
    }

    // Clear existing timeout to prevent memory leaks
    if (timeoutRef.current) {
      logDebug('Clearing existing timeout');
      clearTimeout(timeoutRef.current);
    }

    // Create new timeout with error handling
    try {
      timeoutRef.current = setTimeout(() => {
        debouncedSetValue();
      }, Math.min(delay, options.maxDelay || Infinity));

      logDebug('Set new timeout');
    } catch (error) {
      console.error('[useDebounce] Error setting timeout:', error);
      // Fallback to immediate update in case of timeout error
      debouncedSetValue();
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (timeoutRef.current) {
        logDebug('Cleanup: clearing timeout');
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    value,
    delay,
    options.immediate,
    options.maxDelay,
    debouncedSetValue,
    logDebug
  ]);

  // Return debounced value with type guarantee
  return debouncedValue;
};

export default useDebounce;