/**
 * Barrel file for form components implementing the design system specifications.
 * Provides centralized exports for all form-related components with proper TypeScript types.
 * @version 1.0.0
 */

// Base form field component with Material-UI integration
export { default as FormField } from './FormField';
export type { FormFieldProps } from './FormField';

// Search field component with debouncing functionality
export { default as SearchField } from './SearchField';
export type { SearchFieldProps } from './SearchField';

// Select field component for dropdown functionality
export { default as SelectField } from './SelectField';
export type { SelectFieldProps } from './SelectField';

// Re-export common types used across form components
export type { SelectOption } from './SelectField';