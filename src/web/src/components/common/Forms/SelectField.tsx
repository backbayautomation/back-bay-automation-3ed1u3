import React from 'react'; // ^18.2.0
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material'; // ^5.14.0

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectFieldProps {
  name: string;
  label: string;
  options: SelectOption[];
  value: string | number | Array<string | number>;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  onChange: (value: string | number | Array<string | number>) => void;
  onBlur?: () => void;
}

const SelectField: React.FC<SelectFieldProps> = ({
  name,
  label,
  options,
  value,
  multiple = false,
  required = false,
  disabled = false,
  error,
  helperText,
  onChange,
  onBlur,
}) => {
  // Handle change events and propagate the selected value(s)
  const handleChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    onChange(event.target.value as string | number | Array<string | number>);
  };

  // Handle blur events if provided
  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  return (
    <FormControl
      fullWidth
      error={!!error}
      disabled={disabled}
      required={required}
      sx={{
        marginBottom: 2, // 16px (2 * 8px base unit)
        '& .MuiOutlinedInput-root': {
          '&.Mui-focused fieldset': {
            borderColor: '#0066CC', // Primary color from design system
          },
        },
      }}
    >
      <InputLabel
        id={`${name}-label`}
        sx={{
          fontFamily: 'Roboto, sans-serif',
          '&.Mui-error': {
            color: '#DC3545', // Error color from design system
          },
        }}
      >
        {label}
      </InputLabel>
      <Select
        labelId={`${name}-label`}
        id={name}
        value={value}
        multiple={multiple}
        onChange={handleChange}
        onBlur={handleBlur}
        label={label}
        aria-describedby={`${name}-helper-text`}
        MenuProps={{
          PaperProps: {
            sx: {
              maxHeight: 300, // Reasonable max height for dropdown
            },
          },
          // Improve keyboard navigation
          autoFocus: false,
        }}
        sx={{
          fontFamily: 'Roboto, sans-serif',
          '& .MuiSelect-select': {
            minHeight: '1.4375em', // Consistent height with other form fields
          },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            sx={{
              fontFamily: 'Roboto, sans-serif',
              '&.Mui-selected': {
                backgroundColor: 'rgba(0, 102, 204, 0.08)', // Light primary color for selected state
              },
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {(error || helperText) && (
        <FormHelperText
          id={`${name}-helper-text`}
          sx={{
            fontFamily: 'Roboto, sans-serif',
            '&.Mui-error': {
              color: '#DC3545', // Error color from design system
            },
          }}
        >
          {error || helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default SelectField;