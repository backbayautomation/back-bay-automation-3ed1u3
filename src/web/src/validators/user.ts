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
    async (email) => (await validateEmail(email)).length === 0,
    'Email validation failed'
  );

/**
 * Enhanced password validation schema with complexity requirements
 */
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .refine(
    async (password) => (await validatePassword(password)).length === 0,
    'Password does not meet security requirements'
  );

/**
 * Name validation schema with length restrictions and sanitization
 */
const nameSchema = z.string()
  .min(MIN_NAME_LENGTH, `Name must be at least ${MIN_NAME_LENGTH} characters`)
  .max(MAX_NAME_LENGTH, `Name cannot exceed ${MAX_NAME_LENGTH} characters`)
  .transform(name => name.trim());

/**
 * Role validation schema with role-based access control
 */
const roleSchema = z.nativeEnum(UserRole)
  .refine(
    (role) => Object.values(UserRole).includes(role),
    'Invalid user role'
  );

/**
 * Client ID validation schema with optional null value
 */
const clientIdSchema = z.string().uuid('Invalid client ID format').nullable();

/**
 * Comprehensive schema for user creation with enhanced security validation
 */
export const userCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: nameSchema,
  role: roleSchema,
  clientId: clientIdSchema,
  isActive: z.boolean().default(true)
}).refine(
  (data) => {
    // Additional validation for client admins requiring client ID
    if (data.role === UserRole.CLIENT_ADMIN && !data.clientId) {
      return false;
    }
    return true;
  },
  {
    message: 'Client ID is required for client administrators',
    path: ['clientId']
  }
);

/**
 * Schema for user updates with partial field validation
 */
export const userUpdateSchema = z.object({
  email: emailSchema.optional(),
  fullName: nameSchema.optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  clientId: clientIdSchema.optional()
}).refine(
  (data) => {
    // Validate role changes with client context
    if (data.role === UserRole.CLIENT_ADMIN && data.clientId === null) {
      return false;
    }
    return true;
  },
  {
    message: 'Invalid role and client combination',
    path: ['role', 'clientId']
  }
);

/**
 * Validates user creation data with enhanced security checks
 * @param data - User creation data to validate
 * @returns Validation result with parsed data or error messages
 */
export const validateUserCreate = async (data: unknown): Promise<z.SafeParseReturnType<typeof userCreateSchema._type, User>> => {
  try {
    return await userCreateSchema.safeParseAsync(data);
  } catch (error) {
    return {
      success: false,
      error: error as z.ZodError
    };
  }
};

/**
 * Validates user update data with partial validation support
 * @param data - Partial user update data to validate
 * @returns Validation result with parsed data or error messages
 */
export const validateUserUpdate = async (data: unknown): Promise<z.SafeParseReturnType<typeof userUpdateSchema._type, Partial<User>>> => {
  try {
    return await userUpdateSchema.safeParseAsync(data);
  } catch (error) {
    return {
      success: false,
      error: error as z.ZodError
    };
  }
};