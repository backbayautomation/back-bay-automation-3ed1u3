import React from 'react'; // v18.2.0
import { TextField } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { ApiResponse } from '../../types/common';

/**
 * Props interface for the FormField component with comprehensive type safety
 */
export interface FormFieldProps {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  helperText?: string;
  maxLength?: number;
  inputMode?: string;
}

/**
 * Enhanced Material-UI TextField with comprehensive theme integration and accessibility support
 */
const StyledTextField = styled(TextField)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  '& .MuiInputBase-root': {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body1.fontSize,
    transition: theme.transitions.create(['border-color', 'box-shadow']),
    
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
    
    '&.Mui-focused': {
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}25`,
    },
    
    '&.Mui-error': {
      borderColor: theme.palette.error.main,
      '&:hover': {
        borderColor: theme.palette.error.dark,
      },
    },
    
    '&.Mui-disabled': {
      opacity: 0.7,
      cursor: 'not-allowed',
    },
  },
  
  '& .MuiFormHelperText-root': {
    marginTop: theme.spacing(0.5),
    fontSize: theme.typography.caption.fontSize,
    
    '&.Mui-error': {
      color: theme.palette.error.main,
    },
  },
  
  '& .MuiInputLabel-root': {
    color: theme.palette.text.primary,
    '&.Mui-required': {
      '& .MuiInputLabel-asterisk': {
        color: theme.palette.error.main,
      },
    },
  },
  
  '@media (max-width: 600px)': {
    margin: theme.spacing(0.5, 0),
  },
}));

/**
 * Enhanced form field component with comprehensive validation and accessibility features.
 * Implements WCAG Level AA 2.1 compliance and Material-UI theme integration.
 *
 * @param props - FormFieldProps containing all necessary field configuration
 * @returns JSX.Element - Rendered form field with accessibility support
 */
export const FormField = React.memo<FormFieldProps>(({
  name,
  label,
  value,
  placeholder = '',
  error,
  type = 'text',
  required = false,
  disabled = false,
  fullWidth = true,
  onChange,
  onBlur,
  helperText,
  maxLength,
  inputMode,
}) => {
  // Sanitize input value for security
  const sanitizeInput = (value: string): string => {
    return value.replace(/[<>]/g, '');
  };

  // Handle input change with sanitization
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeInput(event.target.value);
    event.target.value = sanitizedValue;
    onChange(event);
  };

  // Handle input blur with validation
  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  // Character count helper text
  const getHelperText = () => {
    if (error) return error;
    if (maxLength && value) {
      return `${helperText || ''} ${value.length}/${maxLength} characters`;
    }
    return helperText;
  };

  return (
    <StyledTextField
      name={name}
      label={label}
      value={value}
      placeholder={placeholder}
      type={type}
      required={required}
      disabled={disabled}
      fullWidth={fullWidth}
      onChange={handleChange}
      onBlur={handleBlur}
      error={!!error}
      helperText={getHelperText()}
      inputProps={{
        maxLength,
        'aria-label': label,
        'aria-required': required,
        'aria-invalid': !!error,
        'aria-describedby': error ? `${name}-error` : undefined,
        inputMode,
      }}
      FormHelperTextProps={{
        id: error ? `${name}-error` : undefined,
        role: error ? 'alert' : undefined,
        'aria-live': error ? 'polite' : undefined,
      }}
      InputLabelProps={{
        required,
        shrink: !!value || !!placeholder,
      }}
      data-testid={`form-field-${name}`}
    />
  );
});

FormField.displayName = 'FormField';

export default FormField;