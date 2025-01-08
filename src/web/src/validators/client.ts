/**
 * Client validation module implementing comprehensive validation rules for client-related data
 * using Zod schema validation. Provides strict validation for client creation, updates,
 * configuration, and branding with enhanced security measures and multi-tenant support.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { Client } from '../types/client';
import { sanitizeString } from '../utils/validation';

// Validation constants
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
export const validateClientName = (name: string): boolean => {
  if (!name) return false;
  
  const trimmedName = name.trim();
  if (trimmedName.length < CLIENT_NAME_MIN_LENGTH || 
      trimmedName.length > CLIENT_NAME_MAX_LENGTH) {
    return false;
  }
  
  const sanitizedName = sanitizeString(trimmedName);
  return /^[\w\s\-\.]+$/.test(sanitizedName);
};

/**
 * Validates hex color code format
 * @param color - Color code to validate
 * @returns boolean indicating if color code is valid
 */
export const validateHexColor = (color: string): boolean => {
  return COLOR_REGEX.test(color);
};

/**
 * Zod schema for client features configuration
 */
const clientFeaturesSchema = z.object({
  search: z.boolean().default(true),
  export: z.boolean().default(false),
  customization: z.boolean().default(true),
  analytics: z.boolean().default(false)
}).strict();

/**
 * Zod schema for client configuration validation
 */
export const clientConfigSchema = z.object({
  chatEnabled: z.boolean().default(true),
  exportEnabled: z.boolean().default(false),
  maxUsers: z.number()
    .int()
    .min(1)
    .max(MAX_USERS_LIMIT)
    .default(100),
  features: clientFeaturesSchema,
  theme: z.object({
    mode: z.enum(['light', 'dark']).default('light'),
    fontFamily: z.string().min(1).default('Roboto'),
    spacing: z.number().min(0).default(8),
    borderRadius: z.number().min(0).default(4)
  }).strict()
}).strict();

/**
 * Zod schema for client branding validation
 */
export const clientBrandingSchema = z.object({
  primaryColor: z.string()
    .regex(COLOR_REGEX, 'Invalid hex color code')
    .transform(val => val.toUpperCase()),
  logoUrl: z.string()
    .regex(URL_REGEX, 'Invalid secure URL format')
    .url()
    .startsWith('https://', 'URL must use HTTPS'),
  companyName: z.string()
    .min(1)
    .max(100)
    .transform(sanitizeString),
  customStyles: z.record(z.string())
    .refine(styles => {
      return Object.values(styles).every(style => 
        !style.includes('javascript:') && !style.includes('data:')
      );
    }, 'Invalid style values detected')
}).strict();

/**
 * Zod schema for client metadata validation
 */
const clientMetadataSchema = z.object({
  industry: z.string().optional(),
  size: z.enum(['small', 'medium', 'large', 'enterprise']).optional(),
  region: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({})
}).strict();

/**
 * Comprehensive schema for client creation validation
 */
export const createClientSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
  name: z.string()
    .min(CLIENT_NAME_MIN_LENGTH)
    .max(CLIENT_NAME_MAX_LENGTH)
    .transform(sanitizeString)
    .refine(validateClientName, 'Invalid client name format'),
  config: clientConfigSchema,
  branding: clientBrandingSchema,
  metadata: clientMetadataSchema
}).strict();

/**
 * Schema for client update validation with partial fields
 */
export const updateClientSchema = z.object({
  name: z.string()
    .min(CLIENT_NAME_MIN_LENGTH)
    .max(CLIENT_NAME_MAX_LENGTH)
    .transform(sanitizeString)
    .refine(validateClientName, 'Invalid client name format')
    .optional(),
  config: clientConfigSchema.partial(),
  branding: clientBrandingSchema.partial(),
  metadata: clientMetadataSchema.partial()
}).strict();

/**
 * Type inference helpers for client schemas
 */
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientConfig = z.infer<typeof clientConfigSchema>;
export type ClientBranding = z.infer<typeof clientBrandingSchema>;