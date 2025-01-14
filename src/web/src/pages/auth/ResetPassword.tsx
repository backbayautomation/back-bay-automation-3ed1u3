import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';

import AuthLayout from '../../layouts/AuthLayout';
import FormField from '../../components/common/Forms/FormField';
import { passwordResetSchema, PASSWORD_RESET_ERROR_MESSAGES } from '../../validators/auth';
import { AuthService } from '../../services/auth';
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

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const authService = new AuthService();

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

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        if (!token) {
          setError(PASSWORD_RESET_ERROR_MESSAGES.INVALID_TOKEN);
          return;
        }

        const isValid = await authService.validateResetToken(token);
        setIsTokenValid(isValid);
        if (!isValid) {
          setError(PASSWORD_RESET_ERROR_MESSAGES.TOKEN_EXPIRED);
        }
      } catch (err) {
        setError(PASSWORD_RESET_ERROR_MESSAGES.INVALID_TOKEN);
      }
    };

    validateToken();
  }, [token, authService]);

  // Password strength and requirements validation
  const validatePasswordRequirements = useCallback((password: string) => {
    const reqs = {
      length: password.length >= VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const strength = Object.values(reqs).filter(Boolean).length * 20;

    setValidation({
      strength,
      requirements: reqs,
    });

    return Object.values(reqs).every(Boolean);
  }, []);

  // Handle password field changes
  const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'password') {
      validatePasswordRequirements(value);
    }

    if (name === 'confirmPassword') {
      setError(
        value !== formData.password
          ? PASSWORD_RESET_ERROR_MESSAGES.PASSWORDS_DONT_MATCH
          : null
      );
    }
  }, [formData.password, validatePasswordRequirements]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate form data using schema
      await passwordResetSchema.parseAsync(formData);

      // Validate password requirements
      if (!validatePasswordRequirements(formData.password)) {
        throw new Error(PASSWORD_RESET_ERROR_MESSAGES.INSUFFICIENT_COMPLEXITY);
      }

      // Submit password reset request
      await authService.resetPassword(formData.token, formData.password);

      // Navigate to login on success
      navigate('/auth/login', {
        state: { message: 'Password reset successful. Please login with your new password.' }
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : PASSWORD_RESET_ERROR_MESSAGES.SECURITY_VALIDATION_FAILED
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render password requirements list
  const renderRequirements = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" color="textSecondary">
        Password requirements:
      </Typography>
      <ul>
        {Object.entries(validation.requirements).map(([key, met]) => (
          <li key={key} style={{ color: met ? 'green' : 'inherit' }}>
            {key === 'length' ? `Minimum ${VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} characters` : 
             key === 'uppercase' ? 'One uppercase letter' :
             key === 'lowercase' ? 'One lowercase letter' :
             key === 'number' ? 'One number' : 'One special character'}
          </li>
        ))}
      </ul>
    </Box>
  );

  return (
    <AuthLayout redirectTo="/dashboard">
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{ mt: 1 }}
        role="main"
        aria-label="Password reset form"
      >
        <Typography component="h1" variant="h5" align="center" gutterBottom>
          Reset Password
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {error}
          </Alert>
        )}

        {!isTokenValid ? (
          <Alert severity="error">
            {PASSWORD_RESET_ERROR_MESSAGES.INVALID_TOKEN}
          </Alert>
        ) : (
          <>
            <FormField
              name="password"
              label="New Password"
              type="password"
              value={formData.password}
              onChange={handlePasswordChange}
              error={error}
              required
              disabled={isSubmitting}
              fullWidth
              inputMode="text"
              maxLength={VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH}
            />

            <FormField
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={handlePasswordChange}
              error={error}
              required
              disabled={isSubmitting}
              fullWidth
              inputMode="text"
              maxLength={VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH}
            />

            {renderRequirements()}

            <Box sx={{ mt: 3, position: 'relative' }}>
              <button
                type="submit"
                disabled={isSubmitting || !isTokenValid || validation.strength < 100}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: validation.strength === 100 ? '#4CAF50' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Reset Password
              </button>
              {isSubmitting && (
                <CircularProgress
                  size={24}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    marginTop: '-12px',
                    marginLeft: '-12px',
                  }}
                />
              )}
            </Box>
          </>
        )}
      </Box>
    </AuthLayout>
  );
};

export default ResetPassword;