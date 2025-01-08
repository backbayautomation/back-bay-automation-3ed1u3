/**
 * Client validation module implementing comprehensive validation rules for client-related data
 * using Zod schema validation. Ensures data integrity and security for client management.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { Client, ClientStatus } from '../types/client';
import { sanitizeString } from '../utils/validation';

// Constants for validation rules
const CLIENT_NAME_MIN_LENGTH = 2;
const CLIENT_NAME_MAX_LENGTH = 100;
const MAX_USERS_LIMIT = 1000;
const COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const URL_REGEX = /^https:\/\/[\w\-\.]+\.[a-zA-Z]{2,}(\/\S*)?$/;

/**
 * Validates and sanitizes client name
 * @param name Client name to validate
 * @returns boolean indicating if name is valid
 */
const validateClientName = (name: string): boolean => {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < CLIENT_NAME_MIN_LENGTH || trimmed.length > CLIENT_NAME_MAX_LENGTH) return false;
  const sanitized = sanitizeString(trimmed);
  return /^[\w\s\-\.]+$/.test(sanitized);
};

/**
 * Validates hex color code format
 * @param color Color code to validate
 * @returns boolean indicating if color is valid
 */
const validateHexColor = (color: string): boolean => {
  return COLOR_REGEX.test(color);
};

// Schema for client theme configuration
const themeConfigSchema = z.object({
  mode: z.enum(['light', 'dark']),
  colors: z.object({
    primary: z.string().regex(COLOR_REGEX),
    secondary: z.string().regex(COLOR_REGEX),
    background: z.string().regex(COLOR_REGEX),
    text: z.string().regex(COLOR_REGEX)
  }),
  typography: z.object({
    fontFamily: z.string().min(1),
    fontSize: z.string().min(1)
  })
});

// Schema for client configuration
export const clientConfigSchema = z.object({
  chatEnabled: z.boolean(),
  exportEnabled: z.boolean(),
  maxUsers: z.number().int().min(1).max(MAX_USERS_LIMIT),
  features: z.record(z.unknown()),
  theme: themeConfigSchema
});

// Schema for client branding
export const clientBrandingSchema = z.object({
  primaryColor: z.string().regex(COLOR_REGEX),
  logoUrl: z.string().regex(URL_REGEX),
  companyName: z.string()
    .min(1)
    .max(CLIENT_NAME_MAX_LENGTH)
    .transform(sanitizeString),
  customStyles: z.record(z.string()),
  theme: themeConfigSchema.nullable()
});

// Schema for client metadata
const clientMetadataSchema = z.record(z.unknown());

// Schema for creating new client
export const createClientSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string()
    .min(CLIENT_NAME_MIN_LENGTH)
    .max(CLIENT_NAME_MAX_LENGTH)
    .refine(validateClientName, {
      message: 'Invalid client name format'
    }),
  config: clientConfigSchema,
  branding: clientBrandingSchema,
  status: z.nativeEnum(ClientStatus).default(ClientStatus.PENDING),
  metadata: clientMetadataSchema
}).strict();

// Schema for updating existing client
export const updateClientSchema = z.object({
  name: z.string()
    .min(CLIENT_NAME_MIN_LENGTH)
    .max(CLIENT_NAME_MAX_LENGTH)
    .refine(validateClientName, {
      message: 'Invalid client name format'
    })
    .optional(),
  config: clientConfigSchema.partial().optional(),
  branding: clientBrandingSchema.partial().optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  metadata: clientMetadataSchema.optional()
}).strict();

// Type inference helpers
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

// Validation helper functions
export const validateCreateClient = (data: unknown): data is CreateClientInput => {
  try {
    createClientSchema.parse(data);
    return true;
  } catch {
    return false;
  }
};

export const validateUpdateClient = (data: unknown): data is UpdateClientInput => {
  try {
    updateClientSchema.parse(data);
    return true;
  } catch {
    return false;
  }
};