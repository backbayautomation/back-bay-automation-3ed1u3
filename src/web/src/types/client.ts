/**
 * TypeScript type definitions for client-related data structures.
 * Provides comprehensive type safety for client management, multi-tenant data structures,
 * and portal customization features.
 * @version 1.0.0
 */

import { Organization, PaginatedResponse, BaseEntity } from './common';

/**
 * Branded type for client IDs with strict type safety
 */
export type ClientId = string & { readonly __brand: unique symbol };

/**
 * Branded type for organization IDs with strict type safety
 */
export type OrganizationId = string & { readonly __brand: unique symbol };

/**
 * Branded type for hex color validation
 */
export type HexColor = string & { readonly __brand: unique symbol };

/**
 * Branded type for URL validation
 */
export type URL = string & { readonly __brand: unique symbol };

/**
 * Interface for theme configuration
 */
export interface ThemeConfig {
    mode: 'light' | 'dark';
    fontFamily: string;
    spacing: number;
    borderRadius: number;
    shadows: Record<string, string>;
}

/**
 * Interface for client-specific configuration with strict type safety
 */
export interface ClientConfig {
    chatEnabled: boolean;
    exportEnabled: boolean;
    maxUsers: number;
    features: Record<string, unknown>;
    theme: ThemeConfig;
}

/**
 * Interface for client portal branding with validation
 */
export interface ClientBranding {
    primaryColor: HexColor;
    logoUrl: URL;
    companyName: string;
    customStyles: Record<string, string>;
    theme: ThemeConfig | null;
}

/**
 * Enum for client account status
 */
export enum ClientStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PENDING = 'PENDING',
    SUSPENDED = 'SUSPENDED'
}

/**
 * Enhanced interface for complete client data with audit and metadata
 */
export interface Client extends BaseEntity {
    id: ClientId;
    orgId: OrganizationId;
    name: string;
    config: ClientConfig;
    branding: ClientBranding;
    status: ClientStatus;
    organization: Organization | null;
    metadata: Record<string, unknown>;
}

/**
 * Type for paginated client list response
 */
export type ClientList = PaginatedResponse<Client>;