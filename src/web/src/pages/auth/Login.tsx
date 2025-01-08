import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { styled } from '@mui/material/styles';
import { Box, Card, Typography, Checkbox, FormControlLabel, Container } from '@mui/material';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

import FormField from '../../components/common/Forms/FormField';
import LoadingButton from '../../components/common/Buttons/LoadingButton';
import { useAuth } from '../../hooks/useAuth';
import type { LoginCredentials } from '../../types/auth';

// Validation schema with security requirements
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must not exceed 255 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
  rememberMe: yup.boolean()
});

// Styled components with WCAG compliance
const LoginContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: theme.spacing(3),
}));

const LoginCard = styled(Card)(({ theme }) => ({
  width: '100%',
  maxWidth: 400,
  padding: theme.spacing(4),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
  },
  boxShadow: theme.shadows[3],
}));

const LoginTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  color: theme.palette.text.primary,
  textAlign: 'center',
}));

interface LoginFormData extends LoginCredentials {
  rememberMe: boolean;
  mfaCode?: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [showMfa, setShowMfa] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = useCallback(async (formData: LoginFormData) => {
    try {
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
          setError('root', {
            type: 'manual',
            message: 'Invalid email or password',
          });
        }
      }
    }
  }, [login, navigate, setError]);

  return (
    <LoginContainer maxWidth={false}>
      <LoginCard>
        <LoginTitle variant="h4" component="h1">
          Sign In
        </LoginTitle>
        
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Login form"
        >
          <FormField
            {...register('email')}
            label="Email Address"
            type="email"
            error={errors.email?.message}
            required
            fullWidth
            inputMode="email"
            autoComplete="email"
            data-testid="email-input"
          />

          <FormField
            {...register('password')}
            label="Password"
            type="password"
            error={errors.password?.message}
            required
            fullWidth
            autoComplete="current-password"
            data-testid="password-input"
          />

          {showMfa && (
            <FormField
              {...register('mfaCode')}
              label="MFA Code"
              type="text"
              error={errors.mfaCode?.message}
              required
              fullWidth
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              data-testid="mfa-input"
            />
          )}

          <FormControlLabel
            control={
              <Checkbox
                {...register('rememberMe')}
                color="primary"
                data-testid="remember-me-checkbox"
              />
            }
            label="Remember me"
            sx={{ mb: 2 }}
          />

          {errors.root && (
            <Typography
              color="error"
              variant="body2"
              role="alert"
              sx={{ mb: 2 }}
            >
              {errors.root.message}
            </Typography>
          )}

          <LoadingButton
            type="submit"
            variant="primary"
            size="large"
            fullWidth
            isLoading={isLoading}
            loadingText="Signing in..."
            data-testid="submit-button"
          >
            Sign In
          </LoadingButton>
        </Box>
      </LoginCard>
    </LoginContainer>
  );
};

export default Login;