import React, { useState, useEffect, useCallback } from 'react'; // v18.2.0
import { Box, Card, CardContent, Typography, Alert } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { debounce } from 'lodash'; // v4.17.21
import { ChromePicker } from 'react-color'; // v2.19.3

import { FormField, FormFieldProps } from '../../common/Forms/FormField';
import { PrimaryButton } from '../../common/Buttons/PrimaryButton';
import { ClientBranding, isHexColor, isURL } from '../../../types/client';

// Styled components with responsive design
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

// Props interface with enhanced validation
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

// Enhanced branding settings component with real-time preview
export const BrandingSettings = React.memo<BrandingSettingsProps>(({
  initialBranding,
  onSave,
  isLoading,
  onDirtyChange,
}) => {
  // Form state
  const [formData, setFormData] = useState<ClientBranding>(initialBranding);
  const [validationErrors, setValidationErrors] = useState<ValidationState>({
    companyName: null,
    logoUrl: null,
    primaryColor: null,
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Validation rules
  const validateForm = useCallback((data: ClientBranding): ValidationState => {
    const errors: ValidationState = {
      companyName: null,
      logoUrl: null,
      primaryColor: null,
    };

    if (!data.companyName || data.companyName.length < 2) {
      errors.companyName = 'Company name must be at least 2 characters long';
    }

    if (!data.logoUrl || !isURL(data.logoUrl)) {
      errors.logoUrl = 'Please enter a valid URL for the logo';
    }

    if (!data.primaryColor || !isHexColor(data.primaryColor)) {
      errors.primaryColor = 'Please select a valid color';
    }

    return errors;
  }, []);

  // Debounced validation
  const debouncedValidate = useCallback(
    debounce((data: ClientBranding) => {
      const errors = validateForm(data);
      setValidationErrors(errors);
    }, 300),
    [validateForm]
  );

  // Handle form changes
  const handleChange = useCallback((field: keyof ClientBranding) => 
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setFormData(prev => {
        const updated = { ...prev, [field]: newValue };
        debouncedValidate(updated);
        return updated;
      });
    }, [debouncedValidate]);

  // Handle color change
  const handleColorChange = useCallback((color: { hex: string }) => {
    setFormData(prev => ({
      ...prev,
      primaryColor: color.hex as ClientBranding['primaryColor'],
    }));
    debouncedValidate({ ...formData, primaryColor: color.hex as ClientBranding['primaryColor'] });
  }, [formData, debouncedValidate]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateForm(formData);
    setValidationErrors(errors);

    if (Object.values(errors).every(error => error === null)) {
      try {
        await onSave(formData);
        setSaveError(null);
      } catch (error) {
        setSaveError('Failed to save branding settings. Please try again.');
      }
    }
  };

  // Track form dirty state
  useEffect(() => {
    const isDirty = JSON.stringify(formData) !== JSON.stringify(initialBranding);
    onDirtyChange(isDirty);
  }, [formData, initialBranding, onDirtyChange]);

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
              error={validationErrors.companyName}
              required
              fullWidth
            />

            <FormField
              name="logoUrl"
              label="Logo URL"
              value={formData.logoUrl}
              onChange={handleChange('logoUrl')}
              error={validationErrors.logoUrl}
              required
              fullWidth
              helperText="Enter the URL of your company logo"
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Primary Color
              </Typography>
              <Box
                onClick={() => setShowColorPicker(!showColorPicker)}
                sx={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: formData.primaryColor,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              />
              {showColorPicker && (
                <ColorPickerContainer>
                  <ChromePicker
                    color={formData.primaryColor}
                    onChange={handleColorChange}
                    disableAlpha
                  />
                </ColorPickerContainer>
              )}
              {validationErrors.primaryColor && (
                <Typography color="error" variant="caption">
                  {validationErrors.primaryColor}
                </Typography>
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
                  p: 2,
                  backgroundColor: 'background.paper',
                }}
              >
                {formData.logoUrl && (
                  <img
                    src={formData.logoUrl}
                    alt={`${formData.companyName} logo`}
                    style={{ maxHeight: '40px', width: 'auto' }}
                  />
                )}
                <Typography
                  variant="h6"
                  style={{ color: formData.primaryColor }}
                >
                  {formData.companyName}
                </Typography>
              </Box>
            </PreviewContainer>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <PrimaryButton
                type="submit"
                disabled={isLoading || Object.values(validationErrors).some(error => error !== null)}
                onClick={handleSubmit}
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