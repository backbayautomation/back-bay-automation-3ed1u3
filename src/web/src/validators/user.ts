/**
 * User validation module implementing comprehensive security rules and input sanitization
 * using Zod schema validation. Enforces strict validation for user creation, updates,
 * and profile management with enhanced security controls.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { User, UserRole } from '../types/user';
import { validateEmail, validatePassword } from '../utils/validation';

// Constants for validation rules
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_PASSWORD_COMPLEXITY = 80;
const ALLOWED_EMAIL_DOMAINS = ['company.com', 'client.com'];

/**
 * Enhanced email validation schema with domain restrictions and format validation
 */
const emailSchema = z.string()
  .email('Invalid email format')
  .refine((email) => {
    const errors = validateEmail(email);
    return errors.length === 0;
  }, 'Email validation failed')
  .refine((email) => {
    const domain = email.split('@')[1];
    return ALLOWED_EMAIL_DOMAINS.includes(domain);
  }, `Email domain must be one of: ${ALLOWED_EMAIL_DOMAINS.join(', ')}`);

/**
 * Enhanced password validation schema with complexity requirements
 */
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .refine((password) => {
    const errors = validatePassword(password);
    return errors.length === 0;
  }, 'Password does not meet security requirements');

/**
 * Name validation schema with length restrictions and character validation
 */
const nameSchema = z.string()
  .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`)
  .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
  .regex(/^[a-zA-Z\s-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes');

/**
 * Client ID validation schema with UUID format validation
 */
const clientIdSchema = z.string()
  .uuid('Invalid client ID format')
  .nullable();

/**
 * Schema for user creation with comprehensive validation rules
 */
export const userCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: nameSchema,
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Invalid user role' })
  }),
  clientId: clientIdSchema,
  isActive: z.boolean().default(true)
}).refine((data) => {
  // Additional validation for client-specific roles
  if (data.role === UserRole.CLIENT_ADMIN || data.role === UserRole.REGULAR_USER) {
    return data.clientId !== null;
  }
  return true;
}, {
  message: 'Client ID is required for client-specific roles',
  path: ['clientId']
});

/**
 * Schema for user updates with partial validation support
 */
export const userUpdateSchema = z.object({
  email: emailSchema.optional(),
  fullName: nameSchema.optional(),
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Invalid user role' })
  }).optional(),
  isActive: z.boolean().optional(),
  clientId: clientIdSchema.optional()
}).refine((data) => {
  // Validate role changes with client context
  if (data.role && (data.role === UserRole.CLIENT_ADMIN || data.role === UserRole.REGULAR_USER)) {
    return data.clientId !== null;
  }
  return true;
}, {
  message: 'Client ID is required for client-specific roles',
  path: ['clientId']
});

/**
 * Validates user creation data with enhanced security checks
 * @param data - User creation data to validate
 * @returns Validation result with parsed data or error messages
 */
export const validateUserCreate = async (data: unknown): Promise<z.SafeParseReturnType<any, any>> => {
  return userCreateSchema.safeParseAsync(data);
};

/**
 * Validates user update data with partial update support
 * @param data - User update data to validate
 * @returns Validation result with parsed data or error messages
 */
export const validateUserUpdate = async (data: unknown): Promise<z.SafeParseReturnType<any, any>> => {
  return userUpdateSchema.safeParseAsync(data);
};