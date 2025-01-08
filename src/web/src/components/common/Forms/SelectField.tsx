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
  // Handle change event and propagate the selected value(s) to parent
  const handleChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    onChange(event.target.value as string | number | Array<string | number>);
  };

  // Handle blur event if provided
  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  // Generate unique ID for accessibility
  const labelId = `${name}-label`;
  const helperTextId = `${name}-helper-text`;

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
        id={labelId}
        error={!!error}
        required={required}
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
        labelId={labelId}
        id={name}
        name={name}
        value={value}
        multiple={multiple}
        onChange={handleChange}
        onBlur={handleBlur}
        label={label}
        error={!!error}
        aria-describedby={helperTextId}
        MenuProps={{
          PaperProps: {
            sx: {
              maxHeight: 300, // Limit dropdown height for better UX
            },
          },
          // Improve keyboard navigation
          autoFocus: false,
        }}
        sx={{
          fontFamily: 'Roboto, sans-serif',
          '& .MuiSelect-select': {
            minHeight: '1.4375em',
            padding: '16.5px 14px', // Consistent with other form fields
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
                backgroundColor: 'rgba(0, 102, 204, 0.08)', // Primary color with opacity
              },
              '&.Mui-selected:hover': {
                backgroundColor: 'rgba(0, 102, 204, 0.12)',
              },
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Select>

      {(error || helperText) && (
        <FormHelperText
          id={helperTextId}
          error={!!error}
          sx={{
            fontFamily: 'Roboto, sans-serif',
            margin: '4px 14px 0',
          }}
        >
          {error || helperText}
        </FormHelperText>
      )}
    </FormControl>
  );
};

export default SelectField;