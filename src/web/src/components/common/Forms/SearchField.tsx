import React, { useCallback, useEffect } from 'react'; // ^18.2.0
import { IconButton, InputAdornment } from '@mui/material'; // ^5.14.0
import SearchIcon from '@mui/icons-material/Search'; // ^5.14.0
import ClearIcon from '@mui/icons-material/Clear'; // ^5.14.0
import FormField, { FormFieldProps } from './FormField';
import useDebounce from '../../../hooks/useDebounce';

/**
 * Props interface for SearchField component extending FormFieldProps with search-specific functionality
 */
export interface SearchFieldProps extends Omit<FormFieldProps, 'type' | 'label' | 'name'> {
  value: string;
  placeholder?: string;
  debounceMs?: number;
  onSearch: (value: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
  errorMessage?: string;
}

/**
 * Enhanced search field component with debouncing, accessibility features, and Material-UI integration.
 * Implements WCAG Level AA 2.1 compliance and optimized performance with proper cleanup.
 *
 * @param props - SearchFieldProps containing search field configuration
 * @returns JSX.Element - Rendered search field component
 */
export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  placeholder = 'Search...',
  debounceMs = 300,
  onSearch,
  onClear,
  isLoading = false,
  errorMessage,
  onChange,
  ...restProps
}) => {
  // Initialize debounced search with cleanup
  const debouncedValue = useDebounce(value, debounceMs, {
    maxDelay: 1000,
    enableDebug: process.env.NODE_ENV === 'development'
  });

  // Handle debounced search effect
  useEffect(() => {
    if (debouncedValue !== undefined) {
      onSearch(debouncedValue);
    }
  }, [debouncedValue, onSearch]);

  // Handle clear button click
  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
  }, [onClear]);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value && onClear) {
      event.preventDefault();
      handleClear();
    }
  }, [value, onClear, handleClear]);

  // Render search field with enhanced functionality
  return (
    <FormField
      name="search"
      label="Search"
      type="text"
      value={value}
      placeholder={placeholder}
      error={errorMessage}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      inputProps={{
        'aria-label': 'Search input',
        'aria-describedby': errorMessage ? 'search-error' : undefined,
        role: 'searchbox',
        autoComplete: 'off',
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon
              color={isLoading ? 'disabled' : 'action'}
              aria-hidden="true"
            />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton
              aria-label="Clear search"
              onClick={handleClear}
              disabled={isLoading}
              size="small"
              edge="end"
              data-testid="search-clear-button"
            >
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      {...restProps}
      data-testid="search-field"
    />
  );
};

SearchField.displayName = 'SearchField';

export default SearchField;