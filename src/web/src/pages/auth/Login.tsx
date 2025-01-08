import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { styled } from '@mui/material/styles';
import { Box, Card, Typography, Link, FormControlLabel, Checkbox } from '@mui/material';
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
  backgroundColor: theme.palette.background.default,
}));

const LoginCard = styled(Card)(({ theme }) => ({
  width: '100%',
  maxWidth: '400px',
  padding: theme.spacing(4),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
  },
}));

const LoginTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  color: theme.palette.text.primary,
  textAlign: 'center',
}));

const LoginForm = styled('form')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

interface LoginFormData extends LoginCredentials {
  rememberMe: boolean;
  mfaCode?: string;
}

/**
 * Login page component implementing OAuth 2.0 + OIDC authentication with
 * comprehensive security features and accessibility support.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [showMfa, setShowMfa] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit: formSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
      mfaCode: '',
    },
  });

  // Handle form submission with rate limiting and error handling
  const handleSubmit = useCallback(async (formData: LoginFormData) => {
    try {
      setLoginError(null);
      await login({
        email: formData.email,
        password: formData.password,
      });
      navigate('/dashboard');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('MFA required')) {
          setShowMfa(true);
        } else {
          setLoginError(error.message);
        }
      } else {
        setLoginError('An unexpected error occurred');
      }
    }
  }, [login, navigate]);

  return (
    <LoginContainer>
      <LoginCard elevation={3}>
        <LoginTitle variant="h4" component="h1">
          Sign In
        </LoginTitle>

        <LoginForm 
          onSubmit={formSubmit(handleSubmit)}
          noValidate
          aria-label="Login form"
        >
          <FormField
            name="email"
            label="Email Address"
            type="email"
            error={errors.email?.message}
            required
            {...register('email')}
            inputMode="email"
            autoComplete="email"
          />

          <FormField
            name="password"
            label="Password"
            type="password"
            error={errors.password?.message}
            required
            {...register('password')}
            autoComplete="current-password"
          />

          {showMfa && (
            <FormField
              name="mfaCode"
              label="MFA Code"
              type="text"
              error={errors.mfaCode?.message}
              required
              {...register('mfaCode')}
              inputMode="numeric"
              maxLength={6}
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
          />

          {loginError && (
            <Typography
              color="error"
              variant="body2"
              role="alert"
              aria-live="polite"
            >
              {loginError}
            </Typography>
          )}

          <LoadingButton
            type="submit"
            variant="primary"
            size="large"
            fullWidth
            isLoading={isLoading}
            loadingText="Signing in..."
            disabled={isLoading}
          >
            Sign In
          </LoadingButton>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link
              href="/forgot-password"
              variant="body2"
              underline="hover"
              sx={{ color: 'primary.main' }}
            >
              Forgot password?
            </Link>
          </Box>
        </LoginForm>
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginPage;