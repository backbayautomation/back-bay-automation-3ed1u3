/**
 * Core TypeScript type definitions and interfaces for the frontend application.
 * Provides comprehensive type safety, multi-tenant support, and standardized API patterns.
 * @version 1.0.0
 */

/**
 * Branded type for UUID strings with validation
 */
export type UUID = string & { readonly __brand: unique symbol };

/**
 * Type alias for ISO timestamp strings with validation
 */
export type Timestamp = string & { readonly __brand: unique symbol };

/**
 * Recursive type for valid JSON values with strict typing
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Utility type for deeply partial objects with recursive type inference
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type for deeply readonly objects
 */
export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Base interface for organization data in multi-tenant architecture
 */
export interface Organization {
    readonly id: UUID;
    name: string;
    settings: JsonValue;
    readonly createdAt: Timestamp;
    readonly updatedAt: Timestamp;
    metadata: Record<string, JsonValue>;
}

/**
 * Generic interface for paginated API responses with strict typing
 */
export interface PaginatedResponse<T> {
    readonly items: T[];
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
    readonly totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

/**
 * Generic interface for standardized API responses with error handling
 */
export interface ApiResponse<T> {
    readonly success: boolean;
    readonly data: T;
    readonly error: string | null;
    readonly message: string | null;
    readonly statusCode: number;
    readonly metadata: Record<string, unknown>;
}

/**
 * Base interface for all entity types with audit fields
 */
export interface BaseEntity {
    readonly id: UUID;
    readonly createdAt: Timestamp;
    readonly updatedAt: Timestamp;
    createdBy: UUID | null;
    updatedBy: UUID | null;
    isActive: boolean;
    metadata: Record<string, JsonValue>;
}

/**
 * Interface for pagination request parameters with sorting
 */
export interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters: Record<string, string | number | boolean>;
}