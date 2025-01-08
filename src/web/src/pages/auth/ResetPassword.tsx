import React, { useState, useEffect, useCallback } from 'react'; // ^18.2.0
import { useNavigate, useParams } from 'react-router-dom'; // ^6.14.0
import { Box, Typography, Alert, CircularProgress } from '@mui/material'; // ^5.14.0
import AuthLayout from '../../layouts/AuthLayout';
import FormField from '../../components/common/Forms/FormField';
import { passwordResetSchema } from '../../validators/auth';
import { AuthService } from '../../services/auth';

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
          setError('Invalid reset token');
          return;
        }
        const isValid = await authService.validateResetToken(token);
        setIsTokenValid(isValid);
        if (!isValid) {
          setError('Reset token is invalid or has expired');
        }
      } catch (error) {
        setError('Failed to validate reset token');
      }
    };

    validateToken();
  }, [token, authService]);

  // Password validation handler with real-time feedback
  const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormData(prev => ({ ...prev, password: value }));

    // Update password requirements
    const requirements = {
      length: value.length >= 8,
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

    // Clear error when user starts typing
    setError(null);
  }, []);

  // Form submission handler with rate limiting and security measures
  const handleSubmit = async (event: React.ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate form data using schema
      await passwordResetSchema.parseAsync(formData);

      // Attempt password reset
      await authService.resetPassword(formData.token, formData.password);

      // Navigate to login on success
      navigate('/login', { 
        state: { message: 'Password has been successfully reset. Please log in with your new password.' }
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout redirectTo="/dashboard">
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography
          variant="h5"
          component="h1"
          gutterBottom
          align="center"
          sx={{ mb: 3 }}
        >
          Reset Password
        </Typography>

        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            role="alert"
          >
            {error}
          </Alert>
        )}

        {!isTokenValid ? (
          <CircularProgress sx={{ alignSelf: 'center' }} />
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
              fullWidth
              helperText={`Password strength: ${validation.strength}%`}
            />

            <FormField
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                confirmPassword: e.target.value 
              }))}
              error={error}
              required
              fullWidth
            />

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="textSecondary">
                Password requirements:
              </Typography>
              <ul>
                <li style={{ color: validation.requirements.length ? 'green' : 'inherit' }}>
                  At least 8 characters
                </li>
                <li style={{ color: validation.requirements.uppercase ? 'green' : 'inherit' }}>
                  One uppercase letter
                </li>
                <li style={{ color: validation.requirements.lowercase ? 'green' : 'inherit' }}>
                  One lowercase letter
                </li>
                <li style={{ color: validation.requirements.number ? 'green' : 'inherit' }}>
                  One number
                </li>
                <li style={{ color: validation.requirements.special ? 'green' : 'inherit' }}>
                  One special character
                </li>
              </ul>
            </Box>

            <button
              type="submit"
              disabled={isSubmitting || validation.strength < 100}
              style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: validation.strength < 100 ? '#ccc' : '#0066CC',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Reset Password'
              )}
            </button>
          </>
        )}
      </Box>
    </AuthLayout>
  );
};

export default ResetPassword;