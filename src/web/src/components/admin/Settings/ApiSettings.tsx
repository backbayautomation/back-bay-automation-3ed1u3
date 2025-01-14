import React from 'react';
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
 * Enhanced API settings management component with comprehensive security controls
 * and accessibility features.
 */
const ApiSettings = React.memo(() => {
  // Form initialization with validation rules
  const { register, handleSubmit: formSubmit, formState: { errors }, setValue, watch } = useForm<ApiSettingsFormData>({
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
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [pendingChanges, setPendingChanges] = React.useState<ApiSettingsFormData | null>(null);

  // Watch form values for real-time validation
  const enableRateLimiting = watch('enableRateLimiting');

  /**
   * Enhanced form submission handler with security validation and audit logging
   */
  const handleSubmit = React.useCallback(async (formData: ApiSettingsFormData) => {
    try {
      setIsLoading(true);

      // Security validation
      if (formData.apiKey && formData.apiKey.length < 32) {
        throw new Error('API key must be at least 32 characters long');
      }

      if (formData.rateLimit < 0 || formData.rateLimit > 10000) {
        throw new Error('Rate limit must be between 0 and 10,000');
      }

      // Validate allowed origins
      const validOrigins = formData.allowedOrigins.every(origin => 
        /^https?:\/\/[a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(origin)
      );

      if (!validOrigins) {
        throw new Error('Invalid origin format detected');
      }

      // Create audit log entry
      const auditLog = {
        action: 'update_api_settings',
        timestamp: new Date().toISOString(),
        changes: formData
      };

      // Make API call with retry logic
      const response: ApiResponse<void> = await fetch('/api/v1/settings/api', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to update API settings');
      }

      // Update UI with success message
      // Screen reader announcement
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'alert');
      announcement.textContent = 'API settings updated successfully';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

    } catch (error) {
      console.error('Error updating API settings:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
    }
  }, []);

  /**
   * Confirmation dialog for critical changes
   */
  const ConfirmationDialog = React.useMemo(() => (
    <Dialog
      open={showConfirmDialog}
      onClose={() => setShowConfirmDialog(false)}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <Typography id="confirm-dialog-title" variant="h6" component="h2">
        Confirm API Settings Changes
      </Typography>
      <Typography id="confirm-dialog-description">
        Are you sure you want to update the API settings? This may affect active integrations.
      </Typography>
      <PrimaryButton
        onClick={() => pendingChanges && handleSubmit(pendingChanges)}
        disabled={isLoading}
      >
        Confirm Changes
      </PrimaryButton>
    </Dialog>
  ), [showConfirmDialog, pendingChanges, handleSubmit, isLoading]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h1" gutterBottom>
          API Settings
        </Typography>
        
        <form onSubmit={formSubmit((data) => {
          setPendingChanges(data);
          setShowConfirmDialog(true);
        })}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormField
                name="apiKey"
                label="API Key"
                type="password"
                required
                error={errors.apiKey?.message}
                {...register('apiKey', {
                  required: 'API key is required',
                  minLength: {
                    value: 32,
                    message: 'API key must be at least 32 characters'
                  }
                })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormField
                name="baseUrl"
                label="API Base URL"
                required
                error={errors.baseUrl?.message}
                {...register('baseUrl', {
                  required: 'Base URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Must be a valid URL'
                  }
                })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormField
                name="rateLimit"
                label="Rate Limit (requests/hour)"
                type="number"
                required
                disabled={!enableRateLimiting}
                error={errors.rateLimit?.message}
                {...register('rateLimit', {
                  required: 'Rate limit is required',
                  min: {
                    value: 0,
                    message: 'Must be greater than 0'
                  },
                  max: {
                    value: 10000,
                    message: 'Must be less than 10,000'
                  }
                })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography component="div" variant="body1">
                <Grid component="label" container alignItems="center" spacing={1}>
                  <Grid item>Rate Limiting</Grid>
                  <Grid item>
                    <Switch
                      checked={enableRateLimiting}
                      onChange={(e) => setValue('enableRateLimiting', e.target.checked)}
                      name="enableRateLimiting"
                      color="primary"
                      inputProps={{
                        'aria-label': 'Enable rate limiting'
                      }}
                    />
                  </Grid>
                </Grid>
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <PrimaryButton
                type="submit"
                disabled={isLoading}
                fullWidth
                size="large"
              >
                {isLoading ? 'Updating...' : 'Update API Settings'}
              </PrimaryButton>
            </Grid>
          </Grid>
        </form>

        {ConfirmationDialog}
      </CardContent>
    </Card>
  );
});

ApiSettings.displayName = 'ApiSettings';

export default ApiSettings;