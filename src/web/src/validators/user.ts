/**
 * User validation module implementing comprehensive security rules and input sanitization
 * using Zod schema validation. Enforces strict validation for user-related operations
 * with enhanced security checks and multi-tenant validation.
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
  .refine(
    (email) => ALLOWED_EMAIL_DOMAINS.some(domain => email.endsWith(domain)),
    'Email domain not allowed'
  )
  .refine(
    (email) => validateEmail(email).length === 0,
    'Email validation failed'
  );

/**
 * Enhanced password validation schema with complexity requirements
 */
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .refine(
    (password) => validatePassword(password).length === 0,
    'Password does not meet security requirements'
  );

/**
 * Name validation schema with length restrictions and character validation
 */
const nameSchema = z.string()
  .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`)
  .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
  .regex(/^[a-zA-Z\s-']+$/, 'Name contains invalid characters');

/**
 * Client ID validation schema with UUID format check
 */
const clientIdSchema = z.string()
  .uuid('Invalid client ID format')
  .nullable();

/**
 * Role validation schema with role-based restrictions
 */
const roleSchema = z.nativeEnum(UserRole)
  .refine(
    (role) => role !== UserRole.API_SERVICE,
    'API_SERVICE role cannot be assigned manually'
  );

/**
 * Comprehensive schema for user creation with enhanced security validation
 */
export const userCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: nameSchema,
  role: roleSchema,
  clientId: clientIdSchema,
  isActive: z.boolean().default(true),
}).refine(
  (data) => {
    // Additional validation for client admins requiring client ID
    if (data.role === UserRole.CLIENT_ADMIN && !data.clientId) {
      return false;
    }
    return true;
  },
  {
    message: 'Client ID is required for CLIENT_ADMIN role',
    path: ['clientId'],
  }
);

/**
 * Schema for partial user updates with security validation
 */
export const userUpdateSchema = z.object({
  email: emailSchema.optional(),
  fullName: nameSchema.optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  clientId: clientIdSchema.optional(),
}).refine(
  (data) => {
    if (data.role === UserRole.CLIENT_ADMIN && data.clientId === null) {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot remove client ID from CLIENT_ADMIN user',
    path: ['clientId'],
  }
);

/**
 * Validates user creation data with enhanced security checks and multi-tenant validation
 * @param data - User creation data to validate
 * @returns Validation result with parsed data or detailed error messages
 */
export const validateUserCreate = async (data: unknown): Promise<z.SafeParseReturnType<any, any>> => {
  try {
    return userCreateSchema.safeParseAsync(data);
  } catch (error) {
    return {
      success: false,
      error: new z.ZodError([{
        code: 'custom',
        path: [],
        message: 'User validation failed',
      }]),
    };
  }
};

/**
 * Validates user update data with partial update support and security checks
 * @param data - User update data to validate
 * @returns Validation result with parsed data or detailed error messages
 */
export const validateUserUpdate = async (data: unknown): Promise<z.SafeParseReturnType<any, any>> => {
  try {
    return userUpdateSchema.safeParseAsync(data);
  } catch (error) {
    return {
      success: false,
      error: new z.ZodError([{
        code: 'custom',
        path: [],
        message: 'User update validation failed',
      }]),
    };
  }
};

/**
 * Type definitions for validated user data
 */
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;