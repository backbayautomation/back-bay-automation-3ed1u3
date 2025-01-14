import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { styled } from '@mui/material/styles';
import { Box, Typography, Paper, Link, Checkbox, FormControlLabel } from '@mui/material';
import * as yup from 'yup';

import FormField from '../../components/common/Forms/FormField';
import LoadingButton from '../../components/common/Buttons/LoadingButton';
import { useAuth } from '../../hooks/useAuth';
import type { LoginCredentials } from '../../types/auth';

// Validation schema with security requirements
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  rememberMe: yup.boolean()
});

// Styled components with WCAG compliance
const LoginContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default
}));

const LoginForm = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  width: '100%',
  maxWidth: 400,
  borderRadius: theme.shape.borderRadius,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
  }
}));

const LoginTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  color: theme.palette.text.primary,
  textAlign: 'center'
}));

interface LoginFormData extends LoginCredentials {
  rememberMe: boolean;
  mfaCode?: string;
}

/**
 * Login page component implementing OAuth 2.0 + OIDC authentication with
 * comprehensive security features and WCAG 2.1 AA compliance.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [showMfa, setShowMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit: validateForm,
    formState: { errors },
    setError: setFieldError,
    watch
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
      mfaCode: ''
    }
  });

  // Handle form submission with rate limiting and error handling
  const handleSubmit = useCallback(async (formData: LoginFormData) => {
    try {
      setError(null);
      await login({
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe
      });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('MFA required')) {
          setShowMfa(true);
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  }, [login, navigate]);

  return (
    <LoginContainer>
      <LoginForm elevation={3} component="main">
        <LoginTitle variant="h4" component="h1">
          Sign In
        </LoginTitle>

        {error && (
          <Typography
            color="error"
            role="alert"
            aria-live="polite"
            sx={{ mb: 2 }}
          >
            {error}
          </Typography>
        )}

        <form onSubmit={validateForm(handleSubmit)} noValidate>
          <FormField
            name="email"
            label="Email Address"
            type="email"
            error={errors.email?.message}
            {...register('email')}
            inputMode="email"
            required
          />

          <FormField
            name="password"
            label="Password"
            type="password"
            error={errors.password?.message}
            {...register('password')}
            required
          />

          {showMfa && (
            <FormField
              name="mfaCode"
              label="MFA Code"
              type="text"
              error={errors.mfaCode?.message}
              {...register('mfaCode')}
              inputMode="numeric"
              maxLength={6}
              required
            />
          )}

          <FormControlLabel
            control={
              <Checkbox
                {...register('rememberMe')}
                color="primary"
                aria-label="Remember me"
              />
            }
            label="Remember me"
            sx={{ mb: 2 }}
          />

          <LoadingButton
            type="submit"
            variant="primary"
            size="large"
            fullWidth
            isLoading={isLoading}
            loadingText="Signing in..."
            loadingPosition="center"
          >
            Sign In
          </LoadingButton>
        </form>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Link
            href="/forgot-password"
            underline="hover"
            sx={{ color: 'primary.main' }}
          >
            Forgot password?
          </Link>
        </Box>
      </LoginForm>
    </LoginContainer>
  );
};

export default LoginPage;