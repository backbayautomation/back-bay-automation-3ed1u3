/**
 * Core validation utility module providing comprehensive validation functions,
 * schema validation, and data sanitization with enhanced security controls
 * for frontend application data protection.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { 
  VALIDATION_CONSTANTS, 
} from '../config/constants';
import type { ValidationError } from '../types/common';

// Regular expressions for validation
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const SPECIAL_CHARS_REGEX = /[!@#$%^&*(),.?":{}|<>]/;
const COMMON_PASSWORD_PATTERNS = [
  /^123/,
  /password/i,
  /qwerty/i
];

// Zod schemas for validation
const emailSchema = z.string().email().min(1);
const passwordSchema = z.string().min(VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH);
const fileSchema = z.instanceof(File);
const formSchema = z.record(z.unknown());

/**
 * Validates email format using regex pattern and zod schema
 * @param email - Email address to validate
 * @returns Array of validation errors if any
 */
export const validateEmail = (email: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  try {
    emailSchema.parse(email);
  } catch (error) {
    errors.push({
      field: 'email',
      message: 'Invalid email format'
    });
    return errors;
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push({
      field: 'email',
      message: 'Please enter a valid email address'
    });
  }

  return errors;
};

/**
 * Enhanced password validation with complexity scoring and pattern detection
 * @param password - Password to validate
 * @returns Array of validation errors if any
 */
export const validatePassword = (password: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  try {
    passwordSchema.parse(password);
  } catch (error) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} characters long`
    });
    return errors;
  }

  if (password.length > VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password cannot exceed ${VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH} characters`
    });
  }

  // Complexity requirements
  if (!/[A-Z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one uppercase letter'
    });
  }

  if (!/[a-z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one lowercase letter'
    });
  }

  if (!/\d/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one number'
    });
  }

  if (!SPECIAL_CHARS_REGEX.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one special character'
    });
  }

  // Check for common patterns
  for (const pattern of COMMON_PASSWORD_PATTERNS) {
    if (pattern.test(password)) {
      errors.push({
        field: 'password',
        message: 'Password contains a common pattern that is easily guessable'
      });
      break;
    }
  }

  return errors;
};

/**
 * Validates file upload against size, type restrictions and security checks
 * @param file - File object to validate
 * @returns Array of validation errors if any
 */
export const validateFileUpload = (file: File): ValidationError[] => {
  const errors: ValidationError[] = [];

  try {
    fileSchema.parse(file);
  } catch (error) {
    errors.push({
      field: 'file',
      message: 'Invalid file object'
    });
    return errors;
  }

  if (file.size > VALIDATION_CONSTANTS.MAX_FILE_SIZE) {
    errors.push({
      field: 'file',
      message: `File size cannot exceed ${VALIDATION_CONSTANTS.MAX_FILE_SIZE / 1024 / 1024}MB`
    });
  }

  const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (!VALIDATION_CONSTANTS.ALLOWED_FILE_TYPES.includes(fileExtension)) {
    errors.push({
      field: 'file',
      message: `File type not allowed. Supported types: ${VALIDATION_CONSTANTS.ALLOWED_FILE_TYPES.join(', ')}`
    });
  }

  // Additional security check for content type
  const validMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (!validMimeTypes.includes(file.type)) {
    errors.push({
      field: 'file',
      message: 'Invalid file content type'
    });
  }

  return errors;
};

/**
 * Performs form-wide validation with field dependencies
 * @param formData - Form data object to validate
 * @returns Array of validation errors if any
 */
export const validateForm = (formData: Record<string, unknown>): ValidationError[] => {
  const errors: ValidationError[] = [];

  try {
    formSchema.parse(formData);
  } catch (error) {
    errors.push({
      field: 'form',
      message: 'Invalid form data'
    });
    return errors;
  }

  // Validate required fields
  Object.entries(formData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      errors.push({
        field: key,
        message: `${key} is required`
      });
    }
  });

  // Validate field dependencies and constraints
  if (formData.password && formData.confirmPassword) {
    if (formData.password !== formData.confirmPassword) {
      errors.push({
        field: 'confirmPassword',
        message: 'Passwords do not match'
      });
    }
  }

  return errors;
};

/**
 * Sanitizes string input by removing dangerous characters and patterns
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export const sanitizeString = (input: string): string => {
  if (!input) return '';

  let sanitized = input;

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove SQL injection patterns
  sanitized = sanitized.replace(/(\b(select|insert|update|delete|drop|union|exec|eval)\b)/gi, '');

  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
};