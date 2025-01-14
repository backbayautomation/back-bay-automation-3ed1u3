/**
 * Barrel file for form components implementing the design system specifications.
 * Provides centralized exports for form-related components with proper TypeScript types.
 * @version 1.0.0
 */

// Import form components and their types
import FormField, { FormFieldProps } from './FormField';
import SearchField, { SearchFieldProps } from './SearchField';
import SelectField from './SelectField';

// Re-export components and their types
export { FormField, FormFieldProps };
export { SearchField, SearchFieldProps };
export { SelectField };

// Default export for convenient importing
export default {
  FormField,
  SearchField,
  SelectField,
};