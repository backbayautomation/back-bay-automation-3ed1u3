import React, { useState, useEffect, useCallback } from 'react'; // v18.2.0
import { Box, Card, CardContent, Typography, Alert } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { ChromePicker } from 'react-color'; // v2.19.3
import debounce from 'lodash/debounce'; // v4.17.21

import { FormField, FormFieldProps } from '../../common/Forms/FormField';
import { PrimaryButton } from '../../common/Buttons/PrimaryButton';
import { ClientBranding } from '../../../types/client';

// Styled components with enhanced theme integration
const StyledCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  maxWidth: '800px',
  width: '100%',
  boxShadow: theme.shadows[2],
}));

const FormContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  width: '100%',
}));

const PreviewContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
  padding: theme.spacing(2),
  border: '1px solid',
  borderColor: theme.palette.divider,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

const ColorPickerContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  marginTop: theme.spacing(1),
  '& .chrome-picker': {
    boxShadow: 'none !important',
    border: `1px solid ${theme.palette.divider}`,
  },
}));

// Enhanced props interface with validation support
export interface BrandingSettingsProps {
  initialBranding: ClientBranding;
  onSave: (branding: ClientBranding) => Promise<void>;
  isLoading: boolean;
  onDirtyChange: (isDirty: boolean) => void;
}

// Validation state interface
interface ValidationState {
  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
}

// Enhanced form validation with detailed rules
const validateForm = (data: ClientBranding): ValidationState => {
  const errors: ValidationState = {
    companyName: null,
    logoUrl: null,
    primaryColor: null,
  };

  // Company name validation
  if (!data.companyName.trim()) {
    errors.companyName = 'Company name is required';
  } else if (data.companyName.length < 2) {
    errors.companyName = 'Company name must be at least 2 characters';
  } else if (data.companyName.length > 100) {
    errors.companyName = 'Company name must not exceed 100 characters';
  }

  // Logo URL validation
  if (!data.logoUrl) {
    errors.logoUrl = 'Logo URL is required';
  } else {
    try {
      new URL(data.logoUrl as string);
    } catch {
      errors.logoUrl = 'Please enter a valid URL';
    }
  }

  // Primary color validation
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!data.primaryColor) {
    errors.primaryColor = 'Primary color is required';
  } else if (!hexColorRegex.test(data.primaryColor as string)) {
    errors.primaryColor = 'Please enter a valid hex color';
  }

  return errors;
};

// Memoized component with enhanced validation and preview
export const BrandingSettings = React.memo<BrandingSettingsProps>(({
  initialBranding,
  onSave,
  isLoading,
  onDirtyChange,
}) => {
  const [formData, setFormData] = useState<ClientBranding>(initialBranding);
  const [validation, setValidation] = useState<ValidationState>({
    companyName: null,
    logoUrl: null,
    primaryColor: null,
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Debounced validation to prevent excessive re-renders
  const debouncedValidation = useCallback(
    debounce((data: ClientBranding) => {
      setValidation(validateForm(data));
    }, 300),
    []
  );

  // Track form changes
  useEffect(() => {
    const isDirty = JSON.stringify(formData) !== JSON.stringify(initialBranding);
    onDirtyChange(isDirty);
    debouncedValidation(formData);
  }, [formData, initialBranding, onDirtyChange, debouncedValidation]);

  // Handle form field changes
  const handleChange = (field: keyof ClientBranding) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
    setSaveError(null);
  };

  // Handle color picker changes
  const handleColorChange = (color: { hex: string }) => {
    setFormData((prev) => ({
      ...prev,
      primaryColor: color.hex as ClientBranding['primaryColor'],
    }));
    setSaveError(null);
  };

  // Handle form submission with validation
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateForm(formData);
    setValidation(errors);

    if (Object.values(errors).every((error) => error === null)) {
      try {
        await onSave(formData);
        setSaveError(null);
      } catch (error) {
        setSaveError('Failed to save branding settings. Please try again.');
      }
    }
  };

  // Check if form has any validation errors
  const hasErrors = Object.values(validation).some((error) => error !== null);

  return (
    <StyledCard>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Portal Branding Settings
        </Typography>

        <form onSubmit={handleSubmit}>
          <FormContainer>
            <FormField
              name="companyName"
              label="Company Name"
              value={formData.companyName}
              onChange={handleChange('companyName')}
              error={validation.companyName}
              required
              maxLength={100}
            />

            <FormField
              name="logoUrl"
              label="Logo URL"
              value={formData.logoUrl as string}
              onChange={handleChange('logoUrl')}
              error={validation.logoUrl}
              required
              type="url"
            />

            <Box>
              <FormField
                name="primaryColor"
                label="Primary Color"
                value={formData.primaryColor as string}
                onChange={handleChange('primaryColor')}
                error={validation.primaryColor}
                required
                onClick={() => setShowColorPicker(true)}
              />
              {showColorPicker && (
                <ColorPickerContainer>
                  <Box position="absolute" zIndex={1}>
                    <ChromePicker
                      color={formData.primaryColor as string}
                      onChange={handleColorChange}
                      onChangeComplete={handleColorChange}
                    />
                    <Box mt={1}>
                      <PrimaryButton
                        size="small"
                        onClick={() => setShowColorPicker(false)}
                      >
                        Close
                      </PrimaryButton>
                    </Box>
                  </Box>
                </ColorPickerContainer>
              )}
            </Box>

            {saveError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {saveError}
              </Alert>
            )}

            <PreviewContainer>
              <Typography variant="h6" gutterBottom>
                Preview
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  color: formData.primaryColor as string,
                }}
              >
                {formData.logoUrl && (
                  <img
                    src={formData.logoUrl as string}
                    alt={`${formData.companyName} logo`}
                    style={{ maxHeight: 40 }}
                  />
                )}
                <Typography variant="h5">{formData.companyName}</Typography>
              </Box>
            </PreviewContainer>

            <Box sx={{ mt: 2 }}>
              <PrimaryButton
                type="submit"
                disabled={isLoading || hasErrors}
                fullWidth
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </PrimaryButton>
            </Box>
          </FormContainer>
        </form>
      </CardContent>
    </StyledCard>
  );
});

BrandingSettings.displayName = 'BrandingSettings';

export default BrandingSettings;