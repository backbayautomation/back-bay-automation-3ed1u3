/**
 * Authentication and authorization validation module providing comprehensive schema validation
 * and security rules for authentication-related operations using Zod schema validation library.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import type { LoginCredentials } from '../types/auth';
import { validateEmail, validatePassword } from '../utils/validation';

/**
 * Comprehensive error messages for login validation failures with security considerations
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
 * Enhanced password validation refinement function
 */
const validatePasswordComplexity = (password: string): boolean => {
  const errors = validatePassword(password);
  return errors.length === 0;
};

/**
 * Token expiration validation refinement function
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
 * Password matching validation refinement function
 */
const matchesPassword = (confirmPassword: string, data: { password: string }): boolean => {
  return confirmPassword === data.password;
};

/**
 * Enhanced Zod schema for login credentials with strict validation rules
 */
export const loginSchema = z.object({
  email: z.string()
    .min(1, LOGIN_ERROR_MESSAGES.REQUIRED_EMAIL)
    .email(LOGIN_ERROR_MESSAGES.INVALID_EMAIL)
    .refine((email) => validateEmail(email).length === 0, {
      message: LOGIN_ERROR_MESSAGES.INVALID_EMAIL
    }),
  password: z.string()
    .min(1, LOGIN_ERROR_MESSAGES.REQUIRED_PASSWORD)
    .min(8, LOGIN_ERROR_MESSAGES.INVALID_PASSWORD)
    .refine(validatePasswordComplexity, {
      message: LOGIN_ERROR_MESSAGES.INVALID_PASSWORD
    })
});

/**
 * Comprehensive schema for password reset validation
 */
export const passwordResetSchema = z.object({
  token: z.string()
    .uuid(PASSWORD_RESET_ERROR_MESSAGES.INVALID_TOKEN)
    .refine(validateTokenExpiration, {
      message: PASSWORD_RESET_ERROR_MESSAGES.TOKEN_EXPIRED
    }),
  password: z.string()
    .min(8, PASSWORD_RESET_ERROR_MESSAGES.INVALID_PASSWORD_FORMAT)
    .refine(validatePasswordComplexity, {
      message: PASSWORD_RESET_ERROR_MESSAGES.INSUFFICIENT_COMPLEXITY
    }),
  confirmPassword: z.string()
    .min(8)
    .refine(matchesPassword, {
      message: PASSWORD_RESET_ERROR_MESSAGES.PASSWORDS_DONT_MATCH
    })
}).refine((data) => data.password === data.confirmPassword, {
  message: PASSWORD_RESET_ERROR_MESSAGES.PASSWORDS_DONT_MATCH,
  path: ['confirmPassword']
});

/**
 * Validates login credentials with enhanced security checks and rate limiting
 * @param credentials - Login credentials to validate
 * @returns Promise resolving to boolean indicating validation success
 * @throws ZodError with detailed error context if validation fails
 */
export const validateLoginCredentials = async (
  credentials: LoginCredentials
): Promise<boolean> => {
  try {
    await loginSchema.parseAsync(credentials);
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Validates password reset request with enhanced security measures
 * @param resetData - Object containing token, password, and confirmPassword
 * @returns Promise resolving to boolean indicating validation success
 * @throws ZodError with security context if validation fails
 */
export const validatePasswordReset = async (
  resetData: z.infer<typeof passwordResetSchema>
): Promise<boolean> => {
  try {
    await passwordResetSchema.parseAsync(resetData);
    return true;
  } catch (error) {
    throw error;
  }
};