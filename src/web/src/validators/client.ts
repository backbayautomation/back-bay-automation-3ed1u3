/**
 * Client validation module implementing comprehensive validation rules for client management,
 * portal customization, and feature configuration with enhanced security measures.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { Client } from '../types/client';
import { sanitizeString } from '../utils/validation';

// Constants for validation rules
const CLIENT_NAME_MIN_LENGTH = 2;
const CLIENT_NAME_MAX_LENGTH = 100;
const MAX_USERS_LIMIT = 1000;
const COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const URL_REGEX = /^https:\/\/[\w\-\.]+\.[a-zA-Z]{2,}(\/\S*)?$/;

/**
 * Validates and sanitizes client name against length and format requirements
 * @param name - Client name to validate
 * @returns boolean indicating if name is valid
 */
const validateClientName = (name: string): boolean => {
  if (!name) return false;
  
  const trimmedName = name.trim();
  if (
    trimmedName.length < CLIENT_NAME_MIN_LENGTH || 
    trimmedName.length > CLIENT_NAME_MAX_LENGTH
  ) {
    return false;
  }
  
  const sanitizedName = sanitizeString(trimmedName);
  return /^[a-zA-Z0-9\s\-_\.]+$/.test(sanitizedName);
};

/**
 * Validates hex color code format
 * @param color - Color code to validate
 * @returns boolean indicating if color code is valid
 */
const validateHexColor = (color: string): boolean => {
  return COLOR_REGEX.test(color);
};

/**
 * Zod schema for client theme configuration
 */
const themeConfigSchema = z.object({
  mode: z.enum(['light', 'dark']),
  fontFamily: z.string().min(1),
  spacing: z.number().min(0),
  borderRadius: z.number().min(0),
  shadows: z.boolean()
});

/**
 * Zod schema for client configuration validation
 */
export const clientConfigSchema = z.object({
  chatEnabled: z.boolean(),
  exportEnabled: z.boolean(),
  maxUsers: z.number().min(1).max(MAX_USERS_LIMIT),
  features: z.record(z.unknown()),
  theme: themeConfigSchema
}).strict();

/**
 * Zod schema for client branding validation with enhanced security
 */
export const clientBrandingSchema = z.object({
  primaryColor: z.string().refine(validateHexColor, {
    message: 'Invalid hex color code'
  }),
  logoUrl: z.string().url().regex(URL_REGEX, {
    message: 'Logo URL must use HTTPS protocol'
  }),
  companyName: z.string().min(1).max(100).transform(sanitizeString),
  customStyles: z.record(z.string()),
  theme: themeConfigSchema.nullable()
}).strict();

/**
 * Zod schema for client metadata validation
 */
const clientMetadataSchema = z.object({
  industry: z.string().optional(),
  size: z.string().optional(),
  region: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional()
}).strict();

/**
 * Comprehensive schema for client creation with enhanced validation
 */
export const createClientSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().refine(validateClientName, {
    message: `Client name must be between ${CLIENT_NAME_MIN_LENGTH} and ${CLIENT_NAME_MAX_LENGTH} characters and contain only alphanumeric characters, spaces, hyphens, underscores, and dots`
  }),
  config: clientConfigSchema,
  branding: clientBrandingSchema,
  metadata: clientMetadataSchema
}).strict();

/**
 * Schema for client updates with partial validation support
 */
export const updateClientSchema = z.object({
  name: z.string().refine(validateClientName, {
    message: `Client name must be between ${CLIENT_NAME_MIN_LENGTH} and ${CLIENT_NAME_MAX_LENGTH} characters and contain only alphanumeric characters, spaces, hyphens, underscores, and dots`
  }).optional(),
  config: clientConfigSchema.partial().optional(),
  branding: clientBrandingSchema.partial().optional(),
  metadata: clientMetadataSchema.partial().optional()
}).strict();

/**
 * Type inference helpers for client schemas
 */
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientConfig = z.infer<typeof clientConfigSchema>;
export type ClientBranding = z.infer<typeof clientBrandingSchema>;