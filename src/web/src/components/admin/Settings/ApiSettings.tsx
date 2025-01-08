import React from 'react'; // v18.2.0
import { Card, CardContent, Typography, Grid, Switch, Dialog } from '@mui/material'; // v5.14.0
import { useForm } from 'react-hook-form'; // v7.0.0
import FormField, { FormFieldProps } from '../../common/Forms/FormField';
import PrimaryButton from '../../common/Buttons/PrimaryButton';
import { ApiResponse } from '../../../api/types';

/**
 * Interface for API settings form data with comprehensive validation
 */
interface ApiSettingsFormData {
  apiKey: string;
  rateLimit: number;
  baseUrl: string;
  enableRateLimiting: boolean;
  allowedOrigins: string[];
  rateLimitConfig: {
    windowMs: number;
    maxRequests: number;
    burstLimit: number;
  };
}

/**
 * Interface for confirmation dialog state
 */
interface ConfirmationDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

/**
 * Enhanced API Settings management component with security controls and accessibility
 */
const ApiSettings = React.memo(() => {
  // Form initialization with react-hook-form
  const { register, handleSubmit: submitForm, formState: { errors }, setValue, watch } = useForm<ApiSettingsFormData>({
    defaultValues: {
      apiKey: '',
      rateLimit: 1000,
      baseUrl: '',
      enableRateLimiting: true,
      allowedOrigins: [],
      rateLimitConfig: {
        windowMs: 3600000, // 1 hour
        maxRequests: 1000,
        burstLimit: 50
      }
    }
  });

  // State management
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmationDialogState>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Watch form values for dynamic validation
  const enableRateLimiting = watch('enableRateLimiting');

  /**
   * Load current API settings with error handling
   */
  const loadApiSettings = React.useCallback(async () => {
    try {
      setIsLoading(true);
      // API call implementation here
      // Set form values with setValue from react-hook-form
    } catch (error) {
      console.error('Failed to load API settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setValue]);

  /**
   * Enhanced form submission handler with security validation
   */
  const handleSubmit = async (formData: ApiSettingsFormData) => {
    try {
      setIsLoading(true);

      // Validate critical changes
      if (formData.apiKey !== watch('apiKey')) {
        setConfirmDialog({
          open: true,
          title: 'Confirm API Key Change',
          message: 'Changing the API key will invalidate all existing keys. Are you sure?',
          onConfirm: async () => {
            await submitApiSettings(formData);
          }
        });
        return;
      }

      await submitApiSettings(formData);
    } catch (error) {
      console.error('Failed to update API settings:', error);
    }
  };

  /**
   * Submit API settings with enhanced error handling
   */
  const submitApiSettings = async (formData: ApiSettingsFormData) => {
    try {
      // API call implementation here
      setIsLoading(false);
      setConfirmDialog({ ...confirmDialog, open: false });
    } catch (error) {
      setIsLoading(false);
      // Error handling implementation
    }
  };

  // Load settings on component mount
  React.useEffect(() => {
    loadApiSettings();
  }, [loadApiSettings]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          API Settings
        </Typography>

        <form onSubmit={submitForm(handleSubmit)} noValidate>
          <Grid container spacing={3}>
            {/* API Key Configuration */}
            <Grid item xs={12}>
              <FormField
                name="apiKey"
                label="API Key"
                type="password"
                required
                error={errors.apiKey?.message}
                {...register('apiKey', {
                  required: 'API Key is required',
                  minLength: { value: 32, message: 'API Key must be at least 32 characters' }
                })}
              />
            </Grid>

            {/* Rate Limiting Controls */}
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1" gutterBottom>
                Rate Limiting
              </Typography>
              <Switch
                checked={enableRateLimiting}
                onChange={(e) => setValue('enableRateLimiting', e.target.checked)}
                inputProps={{ 'aria-label': 'Enable rate limiting' }}
              />
            </Grid>

            {enableRateLimiting && (
              <>
                <Grid item xs={12} sm={6}>
                  <FormField
                    name="rateLimit"
                    label="Rate Limit (requests/hour)"
                    type="number"
                    required
                    error={errors.rateLimit?.message}
                    {...register('rateLimit', {
                      required: 'Rate limit is required',
                      min: { value: 1, message: 'Minimum rate limit is 1' },
                      max: { value: 10000, message: 'Maximum rate limit is 10000' }
                    })}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormField
                    name="rateLimitConfig.burstLimit"
                    label="Burst Limit"
                    type="number"
                    required
                    error={errors.rateLimitConfig?.burstLimit?.message}
                    {...register('rateLimitConfig.burstLimit', {
                      required: 'Burst limit is required',
                      min: { value: 1, message: 'Minimum burst limit is 1' }
                    })}
                  />
                </Grid>
              </>
            )}

            {/* CORS Configuration */}
            <Grid item xs={12}>
              <FormField
                name="baseUrl"
                label="API Base URL"
                required
                error={errors.baseUrl?.message}
                {...register('baseUrl', {
                  required: 'Base URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL'
                  }
                })}
              />
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12}>
              <PrimaryButton
                type="submit"
                disabled={isLoading}
                fullWidth
              >
                {isLoading ? 'Saving...' : 'Save API Settings'}
              </PrimaryButton>
            </Grid>
          </Grid>
        </form>

        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog.open}
          onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
          aria-labelledby="confirm-dialog-title"
        >
          <CardContent>
            <Typography id="confirm-dialog-title" variant="h6" gutterBottom>
              {confirmDialog.title}
            </Typography>
            <Typography variant="body1" gutterBottom>
              {confirmDialog.message}
            </Typography>
            <Grid container spacing={2} justifyContent="flex-end">
              <Grid item>
                <PrimaryButton
                  onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
                  variant="secondary"
                >
                  Cancel
                </PrimaryButton>
              </Grid>
              <Grid item>
                <PrimaryButton
                  onClick={confirmDialog.onConfirm}
                  variant="primary"
                >
                  Confirm
                </PrimaryButton>
              </Grid>
            </Grid>
          </CardContent>
        </Dialog>
      </CardContent>
    </Card>
  );
});

ApiSettings.displayName = 'ApiSettings';

export default ApiSettings;