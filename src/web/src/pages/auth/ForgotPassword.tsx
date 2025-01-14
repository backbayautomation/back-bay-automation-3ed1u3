import React, { useState, useCallback } from 'react';
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

// Validation schema for email input
const validationSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .trim()
});

// Initial form values
const initialValues: ForgotPasswordFormValues = {
  email: ''
};

// Rate limiting duration in milliseconds
const RATE_LIMIT_DURATION = 60000; // 1 minute

/**
 * ForgotPassword component that implements secure password reset flow
 * with WCAG Level AA 2.1 compliance and comprehensive error handling
 */
const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<ForgotPasswordState>({
    loading: false,
    error: null,
    success: false
  });

  // Track last submission time for rate limiting
  const [lastSubmissionTime, setLastSubmissionTime] = useState<number>(0);

  // Handle form submission with rate limiting and error handling
  const handleSubmit = useCallback(async (values: ForgotPasswordFormValues) => {
    const now = Date.now();
    if (now - lastSubmissionTime < RATE_LIMIT_DURATION) {
      setState(prev => ({
        ...prev,
        error: 'Please wait a moment before trying again'
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    setLastSubmissionTime(now);

    try {
      await forgotPassword(values.email);
      setState({
        loading: false,
        error: null,
        success: true
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to process request',
        success: false
      });
    }
  }, [lastSubmissionTime]);

  // Initialize form handling with validation
  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: handleSubmit
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
          sx={{
            mb: 3,
            color: 'text.primary',
            fontWeight: 500
          }}
        >
          Reset Password
        </Typography>

        {state.success ? (
          <Alert 
            severity="success"
            sx={{ mb: 3 }}
            role="alert"
          >
            If an account exists with this email, you will receive password reset instructions shortly.
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
              size="large"
              fullWidth
              disabled={state.loading || !formik.isValid || !formik.dirty}
              sx={{ mt: 2, mb: 2 }}
              aria-label={state.loading ? 'Submitting request' : 'Reset password'}
            >
              {state.loading ? (
                <CircularProgress 
                  size={24} 
                  color="inherit"
                  aria-label="Processing"
                />
              ) : (
                'Reset Password'
              )}
            </Button>

            <Button
              variant="text"
              color="primary"
              fullWidth
              onClick={() => navigate('/login')}
              sx={{ mt: 1 }}
              aria-label="Return to login page"
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