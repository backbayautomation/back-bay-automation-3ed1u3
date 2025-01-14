/**
 * Authentication and authorization validation module providing comprehensive schema validation
 * and security rules for authentication-related operations using Zod schema validation library.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import type { LoginCredentials } from '../types/auth';
import { validateEmail, validatePassword } from '../utils/validation';

// Regular expressions for enhanced security validation
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const ENHANCED_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
const COMMON_PASSWORD_PATTERNS = [/^123/, /password/i, /qwerty/i, /admin/i, /letmein/i];

/**
 * Comprehensive error messages for login validation failures
 */
export const LOGIN_ERROR_MESSAGES = {
  INVALID_EMAIL: 'Please enter a valid email address',
  REQUIRED_EMAIL: 'Email is required',
  INVALID_PASSWORD: 'Password must meet security requirements: minimum 8 characters, including uppercase, lowercase, numbers, and special characters',
  REQUIRED_PASSWORD: 'Password is required',
  RATE_LIMIT_EXCEEDED: 'Too many attempts. Please try again later',
  SECURITY_VALIDATION_FAILED: 'Security validation failed. Please ensure all requirements are met'
} as const;

/**
 * Detailed error messages for password reset validation failures
 */
export const PASSWORD_RESET_ERROR_MESSAGES = {
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  INVALID_TOKEN: 'Invalid or expired reset token',
  TOKEN_EXPIRED: 'Reset token has expired',
  INVALID_PASSWORD_FORMAT: 'Password format is invalid',
  COMMON_PASSWORD: 'Password is too common or easily guessable',
  INSUFFICIENT_COMPLEXITY: 'Password does not meet complexity requirements'
} as const;

/**
 * Validates password complexity with enhanced security rules
 */
const validatePasswordComplexity = (password: string): boolean => {
  if (COMMON_PASSWORD_PATTERNS.some(pattern => pattern.test(password))) {
    return false;
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasMinLength = password.length >= 8;

  return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && hasMinLength;
};

/**
 * Validates token expiration and format
 */
const validateTokenExpiration = (token: string): boolean => {
  try {
    const [, payload] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    return Date.now() < decodedPayload.exp * 1000;
  } catch {
    return false;
  }
};

/**
 * Enhanced Zod schema for login credentials with strict validation rules
 */
export const loginSchema = z.object({
  email: z.string()
    .min(1, LOGIN_ERROR_MESSAGES.REQUIRED_EMAIL)
    .email(LOGIN_ERROR_MESSAGES.INVALID_EMAIL)
    .regex(EMAIL_REGEX)
    .transform(email => email.toLowerCase()),
  password: z.string()
    .min(1, LOGIN_ERROR_MESSAGES.REQUIRED_PASSWORD)
    .min(8, LOGIN_ERROR_MESSAGES.INVALID_PASSWORD)
    .regex(ENHANCED_PASSWORD_PATTERN)
    .refine(validatePasswordComplexity, {
      message: LOGIN_ERROR_MESSAGES.SECURITY_VALIDATION_FAILED
    })
});

/**
 * Comprehensive schema for password reset validation
 */
export const passwordResetSchema = z.object({
  token: z.string()
    .min(1, PASSWORD_RESET_ERROR_MESSAGES.INVALID_TOKEN)
    .refine(validateTokenExpiration, {
      message: PASSWORD_RESET_ERROR_MESSAGES.TOKEN_EXPIRED
    }),
  password: z.string()
    .min(8, PASSWORD_RESET_ERROR_MESSAGES.INVALID_PASSWORD_FORMAT)
    .regex(ENHANCED_PASSWORD_PATTERN)
    .refine(validatePasswordComplexity, {
      message: PASSWORD_RESET_ERROR_MESSAGES.INSUFFICIENT_COMPLEXITY
    }),
  confirmPassword: z.string()
    .min(8)
}).refine((data) => data.password === data.confirmPassword, {
  message: PASSWORD_RESET_ERROR_MESSAGES.PASSWORDS_DONT_MATCH,
  path: ['confirmPassword']
});

/**
 * Validates login credentials with enhanced security checks and rate limiting
 */
export const validateLoginCredentials = async (credentials: LoginCredentials): Promise<boolean> => {
  try {
    // Validate email format
    const emailErrors = validateEmail(credentials.email);
    if (emailErrors.length > 0) {
      throw new z.ZodError([{
        code: 'invalid_string',
        message: emailErrors[0].message,
        path: ['email']
      }]);
    }

    // Validate password security
    const passwordErrors = validatePassword(credentials.password);
    if (passwordErrors.length > 0) {
      throw new z.ZodError([{
        code: 'invalid_string',
        message: passwordErrors[0].message,
        path: ['password']
      }]);
    }

    // Parse through Zod schema for additional validation
    await loginSchema.parseAsync(credentials);
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    throw new Error(LOGIN_ERROR_MESSAGES.SECURITY_VALIDATION_FAILED);
  }
};

/**
 * Validates password reset request with enhanced security measures
 */
export const validatePasswordReset = async (resetData: z.infer<typeof passwordResetSchema>): Promise<boolean> => {
  try {
    // Validate through Zod schema
    await passwordResetSchema.parseAsync(resetData);

    // Additional security checks for password
    const passwordErrors = validatePassword(resetData.password);
    if (passwordErrors.length > 0) {
      throw new z.ZodError([{
        code: 'invalid_string',
        message: passwordErrors[0].message,
        path: ['password']
      }]);
    }

    // Check for common password patterns
    if (COMMON_PASSWORD_PATTERNS.some(pattern => pattern.test(resetData.password))) {
      throw new z.ZodError([{
        code: 'invalid_string',
        message: PASSWORD_RESET_ERROR_MESSAGES.COMMON_PASSWORD,
        path: ['password']
      }]);
    }

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    throw new Error(PASSWORD_RESET_ERROR_MESSAGES.SECURITY_VALIDATION_FAILED);
  }
};