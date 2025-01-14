import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
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
} from '@mui/material';
import { styled } from '@mui/material/styles';

import ClientLayout from '../../layouts/ClientLayout';
import FormField from '../../components/common/Forms/FormField';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';

// Styled components for enhanced theme integration
const SettingsCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .MuiCardContent-root': {
    padding: theme.spacing(3),
  },
  [theme.breakpoints.down('sm')]: {
    marginBottom: theme.spacing(2),
  },
}));

const SettingSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(4),
  '&:last-child': {
    marginBottom: 0,
  },
}));

// Interface for form data with validation rules
interface SettingsFormData {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
  emailNotifications: boolean;
  darkMode: boolean;
}

// Settings component with memoization
const Settings = React.memo(() => {
  const { user, isLoading, updateUserProfile } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form with react-hook-form
  const {
    handleSubmit,
    register,
    formState: { errors },
    watch,
    setValue
  } = useForm<SettingsFormData>({
    defaultValues: {
      name: user?.fullName || '',
      email: user?.email || '',
      emailNotifications: true,
      darkMode: isDarkMode
    }
  });

  // Form submission handler
  const onSubmit = useCallback(async (data: SettingsFormData) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      // Track settings update attempt
      window.gtag?.('event', 'settings_update_attempt', {
        user_id: user?.id,
        client_id: user?.clientId
      });

      await updateUserProfile({
        fullName: data.name,
        email: data.email,
        ...(data.newPassword && { password: data.newPassword }),
        preferences: {
          emailNotifications: data.emailNotifications,
          darkMode: data.darkMode
        }
      });

      setSaveSuccess(true);
      
      // Track successful settings update
      window.gtag?.('event', 'settings_update_success', {
        user_id: user?.id,
        client_id: user?.clientId
      });

    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to update settings');
      
      // Track settings update failure
      window.gtag?.('event', 'settings_update_error', {
        user_id: user?.id,
        client_id: user?.clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

    } finally {
      setIsSaving(false);
    }
  }, [user, updateUserProfile]);

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
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        sx={{
          p: { xs: 2, sm: 3 },
          maxWidth: 800,
          margin: '0 auto'
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Settings
        </Typography>

        {saveError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {saveError}
          </Alert>
        )}

        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Settings updated successfully
          </Alert>
        )}

        <SettingsCard>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Profile Information
            </Typography>
            <SettingSection>
              <FormField
                name="name"
                label="Full Name"
                value={watch('name')}
                error={errors.name?.message}
                required
                onChange={(e) => setValue('name', e.target.value)}
                maxLength={100}
              />
              <FormField
                name="email"
                label="Email Address"
                value={watch('email')}
                error={errors.email?.message}
                type="email"
                required
                onChange={(e) => setValue('email', e.target.value)}
              />
            </SettingSection>
          </CardContent>
        </SettingsCard>

        <SettingsCard>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Password
            </Typography>
            <SettingSection>
              <FormField
                name="currentPassword"
                label="Current Password"
                value={watch('currentPassword') || ''}
                error={errors.currentPassword?.message}
                type="password"
                onChange={(e) => setValue('currentPassword', e.target.value)}
              />
              <FormField
                name="newPassword"
                label="New Password"
                value={watch('newPassword') || ''}
                error={errors.newPassword?.message}
                type="password"
                onChange={(e) => setValue('newPassword', e.target.value)}
                helperText="Minimum 8 characters"
              />
            </SettingSection>
          </CardContent>
        </SettingsCard>

        <SettingsCard>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Preferences
            </Typography>
            <SettingSection>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography>Email Notifications</Typography>
                <Switch
                  checked={watch('emailNotifications')}
                  onChange={(e) => setValue('emailNotifications', e.target.checked)}
                  inputProps={{ 'aria-label': 'Email notifications toggle' }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography>Dark Mode</Typography>
                <Switch
                  checked={watch('darkMode')}
                  onChange={handleThemeToggle}
                  inputProps={{ 'aria-label': 'Dark mode toggle' }}
                />
              </Box>
            </SettingSection>
          </CardContent>
        </SettingsCard>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSaving}
            sx={{ minWidth: 120 }}
          >
            {isSaving ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    </ClientLayout>
  );
});

Settings.displayName = 'Settings';

export default Settings;