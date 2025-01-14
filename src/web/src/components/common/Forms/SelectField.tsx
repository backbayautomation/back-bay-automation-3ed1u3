import React from 'react'; // ^18.2.0
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material'; // ^5.14.0

interface Option {
  value: string | number;
  label: string;
}

interface SelectFieldProps {
  name: string;
  label: string;
  options: Option[];
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
        marginBottom: 1, // 8px according to design system
        '& .MuiOutlinedInput-root': {
          '&.Mui-focused fieldset': {
            borderColor: '#0066CC', // Primary color from design system
          },
        },
        '& .Mui-error': {
          color: '#DC3545', // Error color from design system
        },
      }}
    >
      <InputLabel
        id={`${name}-label`}
        sx={{
          fontFamily: 'Roboto, sans-serif', // Typography from design system
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
          // Improve accessibility with keyboard navigation
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            sx={{
              fontFamily: 'Roboto, sans-serif', // Typography from design system
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
            fontFamily: 'Roboto, sans-serif', // Typography from design system
          }}
        >
          {error || helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default SelectField;