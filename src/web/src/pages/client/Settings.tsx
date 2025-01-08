import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form'; // v7.45.0
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Skeleton,
  Alert,
  Switch,
} from '@mui/material'; // v5.14.0
import ClientLayout from '../../layouts/ClientLayout';
import FormField from '../../components/common/Forms/FormField';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';

// Interface for form data with validation rules
interface SettingsFormData {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
  emailNotifications: boolean;
  darkMode: boolean;
}

/**
 * Client portal settings page component providing user preference management
 * with real-time validation and secure data handling.
 */
const Settings = React.memo(() => {
  const { user, isLoading: authLoading, updateUserProfile } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize form with react-hook-form
  const {
    handleSubmit,
    register,
    formState: { errors },
    reset,
    watch,
  } = useForm<SettingsFormData>({
    defaultValues: {
      name: user?.fullName || '',
      email: user?.email || '',
      emailNotifications: true,
      darkMode: isDarkMode,
    },
  });

  // Watch password field for conditional validation
  const newPassword = watch('newPassword');

  // Handle form submission with error handling
  const onSubmit = useCallback(async (data: SettingsFormData) => {
    try {
      setIsSubmitting(true);
      setSuccessMessage(null);

      // Update user profile
      await updateUserProfile({
        fullName: data.name,
        email: data.email,
        password: data.newPassword,
        currentPassword: data.currentPassword,
        preferences: {
          emailNotifications: data.emailNotifications,
          darkMode: data.darkMode,
        },
      });

      // Update theme if changed
      if (data.darkMode !== isDarkMode) {
        toggleTheme();
      }

      setSuccessMessage('Settings updated successfully');
      
      // Clear sensitive form fields
      reset({
        ...data,
        currentPassword: '',
        newPassword: '',
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
      setSuccessMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [updateUserProfile, isDarkMode, toggleTheme, reset]);

  // Handle theme toggle
  const handleThemeToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    toggleTheme();
    reset({ ...watch(), darkMode: checked });
  }, [toggleTheme, reset, watch]);

  if (authLoading) {
    return (
      <ClientLayout>
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={200} />
          <Skeleton variant="text" sx={{ mt: 2 }} />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
        </Box>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <Box
        component="main"
        sx={{
          p: { xs: 2, sm: 3 },
          maxWidth: 'md',
          margin: '0 auto',
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ mb: 4 }}
        >
          Settings
        </Typography>

        {successMessage && (
          <Alert 
            severity="success" 
            sx={{ mb: 3 }}
            onClose={() => setSuccessMessage(null)}
          >
            {successMessage}
          </Alert>
        )}

        <Card elevation={2}>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FormField
                name="name"
                label="Full Name"
                value={watch('name')}
                error={errors.name?.message}
                required
                onChange={(e) => register('name').onChange(e)}
                maxLength={100}
              />

              <FormField
                name="email"
                label="Email Address"
                value={watch('email')}
                error={errors.email?.message}
                type="email"
                required
                onChange={(e) => register('email').onChange(e)}
              />

              <FormField
                name="currentPassword"
                label="Current Password"
                value={watch('currentPassword') || ''}
                error={errors.currentPassword?.message}
                type="password"
                required={!!newPassword}
                onChange={(e) => register('currentPassword').onChange(e)}
              />

              <FormField
                name="newPassword"
                label="New Password"
                value={watch('newPassword') || ''}
                error={errors.newPassword?.message}
                type="password"
                helperText="Leave blank to keep current password"
                onChange={(e) => register('newPassword').onChange(e)}
              />

              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Preferences
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Switch
                    checked={watch('emailNotifications')}
                    onChange={(e) => register('emailNotifications').onChange(e)}
                    inputProps={{ 'aria-label': 'Email notifications' }}
                  />
                  <Typography>
                    Receive email notifications
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Switch
                    checked={watch('darkMode')}
                    onChange={handleThemeToggle}
                    inputProps={{ 'aria-label': 'Dark mode' }}
                  />
                  <Typography>
                    Dark mode
                  </Typography>
                </Box>
              </Box>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={isSubmitting}
                sx={{ mt: 2 }}
              >
                {isSubmitting ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Save Changes'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Box>
    </ClientLayout>
  );
});

Settings.displayName = 'Settings';

export default Settings;