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
  Switch
} from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles';
import * as yup from 'yup'; // v1.2.0
import { yupResolver } from '@hookform/resolvers/yup'; // v3.1.0

import ClientLayout from '../../layouts/ClientLayout';
import FormField from '../../components/common/Forms/FormField';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';

// Styled components for enhanced theme integration
const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  transition: theme.transitions.create(['box-shadow']),
  '&:hover': {
    boxShadow: theme.shadows[4],
  },
}));

// Form validation schema
const settingsSchema = yup.object().shape({
  name: yup.string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: yup.string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  currentPassword: yup.string()
    .when('newPassword', {
      is: (val: string) => val && val.length > 0,
      then: yup.string().required('Current password is required to set new password'),
    }),
  newPassword: yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .nullable(),
  emailNotifications: yup.boolean(),
  darkMode: yup.boolean(),
});

// Interface for form data
interface SettingsFormData {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
  emailNotifications: boolean;
  darkMode: boolean;
}

// Main Settings component
const Settings: React.FC = React.memo(() => {
  const { user, isLoading, updateUserProfile } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize form with react-hook-form
  const { 
    register, 
    handleSubmit: handleFormSubmit, 
    formState: { errors }, 
    reset,
    watch,
    setValue 
  } = useForm<SettingsFormData>({
    resolver: yupResolver(settingsSchema),
    defaultValues: {
      name: user?.fullName || '',
      email: user?.email || '',
      emailNotifications: true,
      darkMode: isDarkMode,
    },
  });

  // Handle form submission
  const onSubmit = useCallback(async (data: SettingsFormData) => {
    try {
      setSubmitLoading(true);
      setSuccessMessage(null);

      // Update user profile
      await updateUserProfile({
        fullName: data.name,
        email: data.email,
        ...(data.newPassword && {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
        preferences: {
          emailNotifications: data.emailNotifications,
          darkMode: data.darkMode,
        },
      });

      // Clear sensitive form fields
      setValue('currentPassword', '');
      setValue('newPassword', '');

      setSuccessMessage('Settings updated successfully');

      // Track successful settings update
      if (window.analytics) {
        window.analytics.track('Settings Updated', {
          userId: user?.id,
          updatedFields: Object.keys(data).filter(key => data[key] !== watch(key)),
        });
      }
    } catch (error) {
      console.error('Settings update failed:', error);
      throw new Error('Failed to update settings. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  }, [updateUserProfile, setValue, user?.id, watch]);

  // Handle theme toggle
  const handleThemeToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setValue('darkMode', event.target.checked);
    toggleTheme();
  }, [setValue, toggleTheme]);

  if (isLoading) {
    return (
      <ClientLayout>
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={200} />
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
          mx: 'auto',
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ mb: 4 }}
        >
          Account Settings
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

        <form onSubmit={handleFormSubmit(onSubmit)} noValidate>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Profile Information
              </Typography>
              
              <FormField
                name="name"
                label="Full Name"
                value={watch('name')}
                error={errors.name?.message}
                required
                onChange={(e) => setValue('name', e.target.value)}
              />

              <FormField
                name="email"
                label="Email Address"
                type="email"
                value={watch('email')}
                error={errors.email?.message}
                required
                onChange={(e) => setValue('email', e.target.value)}
              />
            </CardContent>
          </StyledCard>

          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Password
              </Typography>

              <FormField
                name="currentPassword"
                label="Current Password"
                type="password"
                value={watch('currentPassword') || ''}
                error={errors.currentPassword?.message}
                onChange={(e) => setValue('currentPassword', e.target.value)}
              />

              <FormField
                name="newPassword"
                label="New Password"
                type="password"
                value={watch('newPassword') || ''}
                error={errors.newPassword?.message}
                helperText="Leave blank to keep current password"
                onChange={(e) => setValue('newPassword', e.target.value)}
              />
            </CardContent>
          </StyledCard>

          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preferences
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Switch
                  checked={watch('emailNotifications')}
                  onChange={(e) => setValue('emailNotifications', e.target.checked)}
                  inputProps={{ 'aria-label': 'Email notifications' }}
                />
                <Typography>
                  Receive email notifications
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Switch
                  checked={watch('darkMode')}
                  onChange={handleThemeToggle}
                  inputProps={{ 'aria-label': 'Dark mode' }}
                />
                <Typography>
                  Dark mode
                </Typography>
              </Box>
            </CardContent>
          </StyledCard>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitLoading}
              sx={{ minWidth: 120 }}
            >
              {submitLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Save Changes'
              )}
            </Button>
          </Box>
        </form>
      </Box>
    </ClientLayout>
  );
});

Settings.displayName = 'Settings';

export default Settings;