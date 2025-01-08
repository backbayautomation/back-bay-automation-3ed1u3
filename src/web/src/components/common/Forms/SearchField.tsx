import React, { useCallback, useEffect, useRef } from 'react'; // ^18.2.0
import { IconButton, InputAdornment } from '@mui/material'; // ^5.14.0
import SearchIcon from '@mui/icons-material/Search'; // ^5.14.0
import ClearIcon from '@mui/icons-material/Clear'; // ^5.14.0
import FormField, { FormFieldProps } from './FormField';
import useDebounce from '../../../hooks/useDebounce';

/**
 * Props interface for SearchField component extending FormFieldProps
 * with search-specific functionality and accessibility features
 */
export interface SearchFieldProps extends Omit<FormFieldProps, 'type' | 'name' | 'label' | 'onChange'> {
  value: string;
  placeholder?: string;
  debounceMs?: number;
  onSearch: (value: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
  errorMessage?: string;
}

/**
 * Enhanced search field component with debouncing, accessibility features,
 * and proper cleanup handling. Implements WCAG 2.1 AA compliance.
 * 
 * @param props - SearchFieldProps containing search field configuration
 * @returns Rendered search field component with accessibility support
 */
export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  placeholder = 'Search...',
  debounceMs = 300,
  onSearch,
  onClear,
  isLoading = false,
  errorMessage,
  ...formFieldProps
}) => {
  // Refs for component lifecycle management
  const mounted = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize debounced search with cleanup
  const debouncedValue = useDebounce(value, debounceMs, {
    maxDelay: 1000,
    enableDebug: process.env.NODE_ENV === 'development'
  });

  // Handle debounced search with proper cleanup
  useEffect(() => {
    if (mounted.current && debouncedValue !== undefined) {
      onSearch(debouncedValue);
    }
    return () => {
      mounted.current = false;
    };
  }, [debouncedValue, onSearch]);

  // Memoized change handler for performance
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = event.target.value.replace(/[<>]/g, '');
    event.target.value = sanitizedValue;
    onSearch(sanitizedValue);
  }, [onSearch]);

  // Handle clear button click with focus management
  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
      // Maintain focus on input after clearing
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [onClear]);

  // Keyboard event handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && onClear) {
      handleClear();
    }
  }, [handleClear, onClear]);

  // Error boundary for graceful error handling
  const handleError = useCallback((error: Error) => {
    console.error('[SearchField] Error:', error);
    // Implement error reporting service integration here
  }, []);

  try {
    return (
      <FormField
        {...formFieldProps}
        name="search-field"
        label="Search"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        error={errorMessage}
        inputRef={inputRef}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon 
                color={isLoading ? "disabled" : "action"}
                aria-hidden="true"
              />
            </InputAdornment>
          ),
          endAdornment: value && (
            <InputAdornment position="end">
              <IconButton
                onClick={handleClear}
                edge="end"
                aria-label="Clear search"
                disabled={isLoading}
                size="small"
              >
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
          'aria-busy': isLoading,
          'aria-controls': 'search-results',
          'aria-expanded': value.length > 0,
          role: 'searchbox',
          autoComplete: 'off',
        }}
        inputProps={{
          'aria-label': 'Search input',
          'data-testid': 'search-input',
        }}
      />
    );
  } catch (error) {
    handleError(error as Error);
    // Fallback UI in case of error
    return (
      <FormField
        name="search-field"
        label="Search"
        type="text"
        value={value}
        onChange={handleChange}
        error="An error occurred. Please try again."
      />
    );
  }
};

// Display name for debugging
SearchField.displayName = 'SearchField';

export default SearchField;