import React, { useCallback, useEffect, useState } from 'react'; // ^18.2.0
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
 * and Material-UI integration. Implements WCAG Level AA 2.1 compliance.
 * 
 * @param props - SearchFieldProps for component configuration
 * @returns JSX.Element - Rendered search field component
 */
export const SearchField: React.FC<SearchFieldProps> = React.memo(({
  value,
  placeholder = 'Search...',
  debounceMs = 300,
  onSearch,
  onClear,
  isLoading = false,
  errorMessage,
  ...formFieldProps
}) => {
  // Local state for internal value management
  const [searchValue, setSearchValue] = useState<string>(value);

  // Update local state when prop value changes
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // Debounced search handler with cleanup
  const debouncedSearch = useDebounce(searchValue, debounceMs, {
    maxDelay: 1000,
    enableDebug: process.env.NODE_ENV === 'development'
  });

  // Effect to trigger search on debounced value change
  useEffect(() => {
    if (debouncedSearch !== value) {
      onSearch(debouncedSearch);
    }
  }, [debouncedSearch, onSearch, value]);

  // Handle input changes with sanitization
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = event.target.value.replace(/[<>]/g, '');
    setSearchValue(sanitizedValue);
  }, []);

  // Handle clear button click
  const handleClear = useCallback(() => {
    setSearchValue('');
    if (onClear) {
      onClear();
    }
  }, [onClear]);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && searchValue) {
      handleClear();
    }
  }, [searchValue, handleClear]);

  // Render search field with enhanced accessibility and visual feedback
  return (
    <FormField
      {...formFieldProps}
      name="search-field"
      label="Search"
      type="text"
      value={searchValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      error={errorMessage}
      placeholder={placeholder}
      inputProps={{
        'aria-label': 'Search input',
        'aria-describedby': errorMessage ? 'search-error-message' : undefined,
        'role': 'searchbox',
        'autoComplete': 'off',
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
        endAdornment: searchValue ? (
          <InputAdornment position="end">
            <IconButton
              aria-label="Clear search"
              onClick={handleClear}
              edge="end"
              size="small"
              disabled={isLoading}
              sx={{ visibility: searchValue ? 'visible' : 'hidden' }}
            >
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ) : null,
        sx: {
          '&.MuiInputBase-root': {
            transition: 'background-color 0.2s',
            backgroundColor: (theme) => 
              theme.palette.mode === 'light' 
                ? 'rgba(0, 0, 0, 0.03)' 
                : 'rgba(255, 255, 255, 0.05)',
            '&:hover': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'light'
                  ? 'rgba(0, 0, 0, 0.06)'
                  : 'rgba(255, 255, 255, 0.08)',
            },
            '&.Mui-focused': {
              backgroundColor: 'transparent',
            },
          },
        },
      }}
      helperText={errorMessage}
      FormHelperTextProps={{
        id: 'search-error-message',
        role: errorMessage ? 'alert' : undefined,
        'aria-live': 'polite',
      }}
    />
  );
});

// Display name for debugging
SearchField.displayName = 'SearchField';

export default SearchField;