import React, { useState, useCallback } from 'react'; // v18.2.0
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material'; // v5.14.0
import { useNavigate } from 'react-router-dom'; // v6.14.0
import { useFormik } from 'formik'; // v2.4.2
import * as Yup from 'yup'; // v1.2.0

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

// Validation schema with strict email format checking
const validationSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .trim()
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Invalid email format'
    )
});

// Initial form values
const initialValues: ForgotPasswordFormValues = {
  email: ''
};

// Rate limiting constants
const RATE_LIMIT_DURATION = 60000; // 1 minute in milliseconds
const RATE_LIMIT_KEY = 'forgot_password_last_attempt';

/**
 * ForgotPassword component implementing secure password reset flow
 * with rate limiting and WCAG Level AA 2.1 compliance
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
    const now = Date.now();
    
    if (lastAttempt && now - parseInt(lastAttempt) < RATE_LIMIT_DURATION) {
      return false;
    }
    
    localStorage.setItem(RATE_LIMIT_KEY, now.toString());
    return true;
  }, []);

  // Form handling with Formik
  const formik = useFormik({
    initialValues,
    validationSchema,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async (values) => {
      try {
        // Check rate limiting
        if (!checkRateLimit()) {
          setState(prev => ({
            ...prev,
            error: 'Please wait a moment before trying again'
          }));
          return;
        }

        setState(prev => ({ ...prev, loading: true, error: null }));

        // Sanitize email input
        const sanitizedEmail = values.email.toLowerCase().trim();

        // Call password reset API
        await forgotPassword(sanitizedEmail);

        // Show success state
        setState({
          loading: false,
          error: null,
          success: true
        });

      } catch (error) {
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Password reset request failed',
          success: false
        });
      }
    }
  });

  return (
    <AuthLayout redirectTo="/dashboard">
      <Box
        component="main"
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
          <Alert 
            severity="success"
            sx={{ mb: 3 }}
            role="alert"
          >
            Password reset instructions have been sent to your email address.
          </Alert>
        ) : (
          <form
            onSubmit={formik.handleSubmit}
            noValidate
            aria-label="Password reset form"
          >
            <FormField
              name="email"
              label="Email Address"
              type="email"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.email ? formik.errors.email : undefined}
              required
              fullWidth
              disabled={state.loading}
              inputMode="email"
              placeholder="Enter your email address"
            />

            {state.error && (
              <Alert 
                severity="error" 
                sx={{ mb: 2 }}
                role="alert"
              >
                {state.error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              disabled={state.loading || !formik.isValid}
              sx={{ mt: 2, mb: 2 }}
              aria-label={state.loading ? 'Sending reset instructions' : 'Send reset instructions'}
            >
              {state.loading ? (
                <CircularProgress 
                  size={24} 
                  color="inherit" 
                  aria-hidden="true"
                />
              ) : (
                'Send Reset Instructions'
              )}
            </Button>

            <Button
              variant="text"
              color="primary"
              fullWidth
              onClick={() => navigate('/login')}
              sx={{ mt: 1 }}
              aria-label="Back to login"
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