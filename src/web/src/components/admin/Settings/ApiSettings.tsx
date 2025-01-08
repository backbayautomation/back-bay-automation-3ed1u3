import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  Switch, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { FormField, FormFieldProps } from '../../common/Forms/FormField';
import { PrimaryButton } from '../../common/Buttons/PrimaryButton';
import { ApiResponse } from '../../../api/types';
import { UserRole } from '../../../types/auth';

// Interface for API settings form data with validation rules
interface ApiSettingsFormData {
  apiKey: string;
  rateLimit: number;
  baseUrl: string;
  enableRateLimiting: boolean;
  allowedOrigins: string[];
  rateLimitConfig: {
    windowSize: number;
    maxRequests: number;
    burstSize: number;
  };
}

// Default values for rate limiting configuration
const DEFAULT_RATE_LIMIT_CONFIG = {
  windowSize: 3600,
  maxRequests: 1000,
  burstSize: 50
};

/**
 * Enhanced API Settings management component with comprehensive security controls
 * and accessibility features.
 */
const ApiSettings = React.memo(() => {
  // Form state management with validation
  const { control, handleSubmit: submitForm, reset, formState: { errors, isDirty } } = useForm<ApiSettingsFormData>({
    defaultValues: {
      apiKey: '',
      rateLimit: 1000,
      baseUrl: '',
      enableRateLimiting: true,
      allowedOrigins: [],
      rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG
    }
  });

  // Component state
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [newOrigin, setNewOrigin] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load current API settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        // API call would go here
        const response = await fetch('/api/v1/settings/api');
        const data = await response.json();
        reset(data);
      } catch (err) {
        setError('Failed to load API settings');
        console.error('Error loading API settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [reset]);

  // Handle form submission with security validation
  const handleSubmit = useCallback(async (formData: ApiSettingsFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate CORS origins
      const validOrigins = formData.allowedOrigins.every(origin => 
        /^https?:\/\/[a-zA-Z0-9-.]+(:\d+)?$/.test(origin)
      );

      if (!validOrigins) {
        throw new Error('Invalid CORS origin format detected');
      }

      // API call would go here
      const response: ApiResponse = await fetch('/api/v1/settings/api', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to update API settings');
      }

      // Create audit log entry
      await fetch('/api/v1/audit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'UPDATE_API_SETTINGS',
          details: formData
        })
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      console.error('Error updating API settings:', err);
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
    }
  }, []);

  // Handle CORS origin management
  const handleAddOrigin = useCallback(() => {
    if (newOrigin && /^https?:\/\/[a-zA-Z0-9-.]+(:\d+)?$/.test(newOrigin)) {
      control._fields.allowedOrigins?.setValue([
        ...(control._fields.allowedOrigins.value || []),
        newOrigin
      ]);
      setNewOrigin('');
    }
  }, [newOrigin, control]);

  const handleRemoveOrigin = useCallback((originToRemove: string) => {
    control._fields.allowedOrigins?.setValue(
      control._fields.allowedOrigins.value.filter(origin => origin !== originToRemove)
    );
  }, [control]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          API Settings
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={submitForm((data) => setShowConfirmDialog(true))}>
          <Grid container spacing={3}>
            {/* API Key Management */}
            <Grid item xs={12}>
              <Controller
                name="apiKey"
                control={control}
                rules={{ required: 'API Key is required' }}
                render={({ field }) => (
                  <FormField
                    {...field}
                    label="API Key"
                    type="password"
                    error={errors.apiKey?.message}
                    disabled={isLoading}
                    fullWidth
                  />
                )}
              />
            </Grid>

            {/* Base URL Configuration */}
            <Grid item xs={12}>
              <Controller
                name="baseUrl"
                control={control}
                rules={{ 
                  required: 'Base URL is required',
                  pattern: {
                    value: /^https?:\/\/[a-zA-Z0-9-.]+\.[a-zA-Z]{2,}(\/\S*)?$/,
                    message: 'Invalid URL format'
                  }
                }}
                render={({ field }) => (
                  <FormField
                    {...field}
                    label="Base URL"
                    error={errors.baseUrl?.message}
                    disabled={isLoading}
                    fullWidth
                  />
                )}
              />
            </Grid>

            {/* Rate Limiting Controls */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Rate Limiting
              </Typography>
              <Controller
                name="enableRateLimiting"
                control={control}
                render={({ field }) => (
                  <Switch
                    {...field}
                    checked={field.value}
                    disabled={isLoading}
                    aria-label="Enable rate limiting"
                  />
                )}
              />
            </Grid>

            {/* Rate Limit Configuration */}
            <Grid item xs={12} md={4}>
              <Controller
                name="rateLimitConfig.maxRequests"
                control={control}
                rules={{ 
                  required: 'Max requests is required',
                  min: { value: 1, message: 'Must be greater than 0' }
                }}
                render={({ field }) => (
                  <FormField
                    {...field}
                    label="Max Requests"
                    type="number"
                    error={errors.rateLimitConfig?.maxRequests?.message}
                    disabled={isLoading}
                    fullWidth
                  />
                )}
              />
            </Grid>

            {/* CORS Origins Management */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Allowed Origins (CORS)
              </Typography>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs>
                  <FormField
                    value={newOrigin}
                    onChange={(e) => setNewOrigin(e.target.value)}
                    label="Add Origin"
                    placeholder="https://example.com"
                    disabled={isLoading}
                    fullWidth
                  />
                </Grid>
                <Grid item>
                  <IconButton
                    onClick={handleAddOrigin}
                    disabled={isLoading || !newOrigin}
                    aria-label="Add origin"
                  >
                    <AddIcon />
                  </IconButton>
                </Grid>
              </Grid>
              
              <Grid container spacing={1} sx={{ mt: 1 }}>
                <Controller
                  name="allowedOrigins"
                  control={control}
                  render={({ field }) => (
                    <>
                      {field.value.map((origin: string) => (
                        <Grid item key={origin}>
                          <Chip
                            label={origin}
                            onDelete={() => handleRemoveOrigin(origin)}
                            disabled={isLoading}
                          />
                        </Grid>
                      ))}
                    </>
                  )}
                />
              </Grid>
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12}>
              <PrimaryButton
                type="submit"
                disabled={isLoading || !isDirty}
                fullWidth
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </PrimaryButton>
            </Grid>
          </Grid>
        </form>

        {/* Confirmation Dialog */}
        <Dialog
          open={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          aria-labelledby="confirm-dialog-title"
        >
          <DialogTitle id="confirm-dialog-title">
            Confirm API Settings Changes
          </DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to update the API settings? This may affect active integrations.
            </Typography>
          </DialogContent>
          <DialogActions>
            <PrimaryButton
              onClick={() => setShowConfirmDialog(false)}
              variant="secondary"
            >
              Cancel
            </PrimaryButton>
            <PrimaryButton
              onClick={submitForm(handleSubmit)}
              disabled={isLoading}
            >
              Confirm Changes
            </PrimaryButton>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
});

ApiSettings.displayName = 'ApiSettings';

export default ApiSettings;