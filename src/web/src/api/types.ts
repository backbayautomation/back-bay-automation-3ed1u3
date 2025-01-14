/**
 * Core TypeScript type definitions for API request/response structures, error handling,
 * HTTP client configurations, and multi-tenant support.
 * @version 1.0.0
 */

import { AxiosRequestConfig } from 'axios'; // v1.5.0
import { AuthTokens } from '../types/auth';
import { UUID, JsonValue } from '../types/common';

/**
 * Enum for supported HTTP methods
 */
export enum HttpMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH'
}

/**
 * Enum for sort directions in paginated requests
 */
export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC'
}

/**
 * Enum for supported content types in API requests
 */
export enum ContentType {
    APPLICATION_JSON = 'application/json',
    MULTIPART_FORM_DATA = 'multipart/form-data',
    TEXT_PLAIN = 'text/plain'
}

/**
 * Generic interface for standardized API responses
 */
export interface ApiResponse<T> {
    data: T;
    message: string;
    success: boolean;
    statusCode: number;
}

/**
 * Interface for enhanced API error responses with tracking
 */
export interface ApiError {
    message: string;
    statusCode: number;
    errors: string[];
    errorCode: string;
    requestId: UUID;
    metadata: Record<string, unknown>;
}

/**
 * Extended Axios request configuration with security and multi-tenant support
 */
export interface ApiRequestConfig extends AxiosRequestConfig {
    requiresAuth: boolean;
    skipErrorHandler: boolean;
    clientId?: UUID;
    organizationId?: UUID;
    securityHeaders: Record<string, string>;
    timeout: number;
    validateStatus: (status: number) => boolean;
}

/**
 * Interface for multi-tenant aware pagination parameters
 */
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    order?: SortOrder;
    clientId?: UUID;
    organizationId?: UUID;
    searchQuery?: string;
    filters: Record<string, string>;
}

/**
 * Type for custom API headers with security considerations
 */
export type ApiHeaders = {
    'Content-Type': ContentType;
    'Authorization'?: string;
    'X-Client-Id'?: UUID;
    'X-Organization-Id'?: UUID;
    'X-Request-Id': UUID;
    'X-API-Version': string;
} & Record<string, string>;

/**
 * Type for URL query parameters with multi-tenant support
 */
export type QueryParams = {
    clientId?: UUID;
    organizationId?: UUID;
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: SortOrder;
    searchQuery?: string;
    [key: string]: string | number | boolean | string[] | undefined;
};

/**
 * Default API request configuration
 */
export const DEFAULT_API_CONFIG: Partial<ApiRequestConfig> = {
    timeout: 30000,
    validateStatus: (status: number) => status >= 200 && status < 300,
    headers: {
        'Content-Type': ContentType.APPLICATION_JSON,
        'X-API-Version': '1.0'
    }
} as const;

/**
 * Type guard for checking if a response is an API error
 */
export function isApiError(error: unknown): error is ApiError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        'message' in error &&
        'errorCode' in error
    );
}

/**
 * Type guard for validating pagination parameters
 */
export function isPaginationParams(params: unknown): params is PaginationParams {
    return (
        typeof params === 'object' &&
        params !== null &&
        'page' in params &&
        'limit' in params &&
        typeof (params as PaginationParams).page === 'number' &&
        typeof (params as PaginationParams).limit === 'number'
    );
}