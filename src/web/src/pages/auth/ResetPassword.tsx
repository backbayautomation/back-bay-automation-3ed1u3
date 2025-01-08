import React, { useState, useEffect, useCallback } from 'react'; // ^18.2.0
import { useNavigate, useParams } from 'react-router-dom'; // ^6.14.0
import { Box, Typography, Alert, CircularProgress } from '@mui/material'; // ^5.14.0

import AuthLayout from '../../layouts/AuthLayout';
import FormField from '../../components/common/Forms/FormField';
import { passwordResetSchema } from '../../validators/auth';
import AuthService from '../../services/auth';
import { VALIDATION_CONSTANTS } from '../../config/constants';

// Interface for password reset form data
interface ResetPasswordFormData {
  token: string;
  password: string;
  confirmPassword: string;
}

// Interface for password validation state
interface PasswordValidationState {
  strength: number;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

/**
 * Enhanced password reset component with comprehensive security features
 * and WCAG Level AA 2.1 compliance
 */
const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  // Form state management
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    token: token || '',
    password: '',
    confirmPassword: '',
  });

  // Validation and UI state management
  const [validation, setValidation] = useState<PasswordValidationState>({
    strength: 0,
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Validates reset token on component mount
   */
  useEffect(() => {
    const validateToken = async () => {
      try {
        if (!token) {
          throw new Error('Reset token is missing');
        }

        const isValid = await AuthService.validateResetToken(token);
        setIsTokenValid(isValid);
      } catch (error) {
        setError('Invalid or expired reset token. Please request a new one.');
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  /**
   * Handles password field changes with real-time validation
   */
  const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    
    // Update password requirements
    const requirements = {
      length: value.length >= VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH,
      uppercase: /[A-Z]/.test(value),
      lowercase: /[a-z]/.test(value),
      number: /\d/.test(value),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(value),
    };

    // Calculate password strength (0-100)
    const strengthScore = Object.values(requirements).filter(Boolean).length * 20;

    setValidation({
      strength: strengthScore,
      requirements,
    });

    setFormData(prev => ({
      ...prev,
      password: value,
    }));
  }, []);

  /**
   * Handles form submission with enhanced security measures
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate form data using Zod schema
      await passwordResetSchema.parseAsync(formData);

      // Attempt password reset
      await AuthService.resetPassword(formData.token, formData.password);

      // Navigate to login on success
      navigate('/auth/login', {
        state: { message: 'Password reset successful. Please log in with your new password.' }
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Password reset failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AuthLayout redirectTo="/dashboard">
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      </AuthLayout>
    );
  }

  if (!isTokenValid) {
    return (
      <AuthLayout redirectTo="/dashboard">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Invalid reset token'}
        </Alert>
        <Typography align="center">
          Please request a new password reset link.
        </Typography>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout redirectTo="/dashboard">
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Password reset form"
      >
        <Typography variant="h5" align="center" gutterBottom>
          Reset Your Password
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {error}
          </Alert>
        )}

        <FormField
          name="password"
          label="New Password"
          type="password"
          value={formData.password}
          onChange={handlePasswordChange}
          error={validation.strength < 60 ? 'Password is not strong enough' : undefined}
          helperText={`Password strength: ${validation.strength}%`}
          required
          fullWidth
        />

        <FormField
          name="confirmPassword"
          label="Confirm Password"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            confirmPassword: e.target.value,
          }))}
          error={
            formData.confirmPassword && formData.password !== formData.confirmPassword
              ? 'Passwords do not match'
              : undefined
          }
          required
          fullWidth
        />

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="textSecondary">
            Password must contain:
          </Typography>
          <ul>
            {Object.entries(validation.requirements).map(([key, met]) => (
              <Typography
                key={key}
                component="li"
                variant="caption"
                color={met ? 'success.main' : 'text.secondary'}
                sx={{ ml: 2 }}
              >
                {key === 'length' ? `At least ${VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} characters` : 
                 key === 'uppercase' ? 'One uppercase letter' :
                 key === 'lowercase' ? 'One lowercase letter' :
                 key === 'number' ? 'One number' :
                 'One special character'}
              </Typography>
            ))}
          </ul>
        </Box>

        <Box sx={{ mt: 3 }}>
          <button
            type="submit"
            disabled={isSubmitting || validation.strength < 60 || formData.password !== formData.confirmPassword}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#0066CC',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Reset Password'
            )}
          </button>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default ResetPassword;