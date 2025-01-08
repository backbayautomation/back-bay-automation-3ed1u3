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
 * Interface for theme configuration with strict typing
 */
export interface ThemeConfig {
    mode: 'light' | 'dark';
    colors: {
        primary: HexColor;
        secondary: HexColor;
        background: HexColor;
        text: HexColor;
    };
    typography: {
        fontFamily: string;
        fontSize: string;
    };
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
 * Extends BaseEntity for standardized audit fields
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

/**
 * Type guard for validating hex color strings
 */
export function isHexColor(value: string): value is HexColor {
    return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/**
 * Type guard for validating URL strings
 */
export function isURL(value: string): value is URL {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Type guard for validating client status
 */
export function isClientStatus(value: string): value is ClientStatus {
    return Object.values(ClientStatus).includes(value as ClientStatus);
}