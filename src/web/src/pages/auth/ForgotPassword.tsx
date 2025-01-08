import React, { useState, useCallback } from 'react';
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import AuthLayout from '../../layouts/AuthLayout';
import FormField from '../../components/common/Forms/FormField';
import { forgotPassword } from '../../api/auth';

// Interface for form values
interface ForgotPasswordFormValues {
  email: string;
}

// Interface for component state
interface ForgotPasswordState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

// Validation schema with proper email format checking
const validationSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .trim()
    .max(255, 'Email must not exceed 255 characters')
});

// Initial form values
const initialValues: ForgotPasswordFormValues = {
  email: ''
};

// Rate limiting constants
const RATE_LIMIT_DURATION = 60000; // 1 minute in milliseconds
const RATE_LIMIT_KEY = 'forgot_password_last_attempt';

/**
 * ForgotPassword component that implements secure password reset flow
 * with rate limiting, validation, and accessibility features.
 */
const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<ForgotPasswordState>({
    loading: false,
    error: null,
    success: false
  });

  // Rate limiting check
  const checkRateLimit = useCallback((): boolean => {
    const lastAttempt = localStorage.getItem(RATE_LIMIT_KEY);
    if (lastAttempt) {
      const timeDiff = Date.now() - parseInt(lastAttempt, 10);
      if (timeDiff < RATE_LIMIT_DURATION) {
        setState(prev => ({
          ...prev,
          error: `Please wait ${Math.ceil((RATE_LIMIT_DURATION - timeDiff) / 1000)} seconds before trying again`
        }));
        return false;
      }
    }
    return true;
  }, []);

  // Form handling with Formik
  const formik = useFormik({
    initialValues,
    validationSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      if (!checkRateLimit()) return;

      setState({ loading: true, error: null, success: false });
      try {
        await forgotPassword(values.email.trim().toLowerCase());
        setState({
          loading: false,
          error: null,
          success: true
        });
        localStorage.setItem(RATE_LIMIT_KEY, Date.now().toString());
      } catch (error) {
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to process request',
          success: false
        });
      }
    }
  });

  return (
    <AuthLayout redirectTo="/dashboard">
      <Box
        component="section"
        role="main"
        aria-labelledby="forgot-password-title"
      >
        <Typography
          id="forgot-password-title"
          variant="h4"
          component="h1"
          align="center"
          gutterBottom
          sx={{ mb: 3 }}
        >
          Reset Password
        </Typography>

        {state.success ? (
          <Box>
            <Alert 
              severity="success"
              sx={{ mb: 3 }}
              role="alert"
            >
              Password reset instructions have been sent to your email address.
            </Alert>
            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/login')}
              aria-label="Return to login page"
            >
              Return to Login
            </Button>
          </Box>
        ) : (
          <form
            onSubmit={formik.handleSubmit}
            noValidate
            aria-label="Password reset form"
          >
            <Typography
              variant="body1"
              color="text.secondary"
              align="center"
              sx={{ mb: 3 }}
            >
              Enter your email address and we'll send you instructions to reset your password.
            </Typography>

            {state.error && (
              <Alert 
                severity="error" 
                sx={{ mb: 3 }}
                role="alert"
              >
                {state.error}
              </Alert>
            )}

            <FormField
              name="email"
              label="Email Address"
              type="email"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.email && formik.errors.email}
              required
              fullWidth
              disabled={state.loading}
              inputMode="email"
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={state.loading}
              sx={{ mt: 3, mb: 2 }}
              aria-label="Submit password reset request"
            >
              {state.loading ? (
                <CircularProgress 
                  size={24} 
                  color="inherit"
                  aria-label="Processing request"
                />
              ) : (
                'Reset Password'
              )}
            </Button>

            <Button
              fullWidth
              variant="text"
              onClick={() => navigate('/login')}
              disabled={state.loading}
              sx={{ mt: 1 }}
              aria-label="Cancel and return to login"
            >
              Back to Login
            </Button>
          </form>
        )}
      </Box>
    </AuthLayout>
  );
};

export default ForgotPassword;