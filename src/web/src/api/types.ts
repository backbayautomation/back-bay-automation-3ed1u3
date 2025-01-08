/**
 * Core TypeScript type definitions for API request/response structures.
 * Provides comprehensive type safety for all API interactions with enhanced security features.
 * @version 1.0.0
 */

import { AxiosRequestConfig } from 'axios'; // v1.5.0
import { AuthTokens } from '../types/auth';

/**
 * Enum for supported HTTP methods with strict typing
 */
export enum HttpMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    PATCH = 'PATCH'
}

/**
 * Enum for sort order directions
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
export interface ApiResponse<T = unknown> {
    data: T;
    message: string;
    success: boolean;
    statusCode: number;
}

/**
 * Interface for comprehensive API error responses
 */
export interface ApiError {
    message: string;
    statusCode: number;
    errors: string[];
    errorCode: string;
    requestId: string;
    metadata: Record<string, unknown>;
}

/**
 * Extended Axios request configuration with security enhancements
 */
export interface ApiRequestConfig extends AxiosRequestConfig {
    requiresAuth: boolean;
    skipErrorHandler: boolean;
    clientId?: string;
    organizationId?: string;
    securityHeaders?: Record<string, string>;
    timeout?: number;
    validateStatus?: (status: number) => boolean;
}

/**
 * Interface for multi-tenant aware pagination parameters
 */
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    order?: SortOrder;
    clientId?: string;
    organizationId?: string;
    searchQuery?: string;
    filters?: Record<string, string>;
}

/**
 * Type for custom API headers with security considerations
 */
export type ApiHeaders = {
    'Authorization'?: string;
    'Content-Type': ContentType;
    'X-Client-Id'?: string;
    'X-Organization-Id'?: string;
    'X-Request-Id': string;
    'X-API-Version'?: string;
} & Record<string, string>;

/**
 * Type for URL query parameters with multi-tenant support
 */
export type QueryParams = {
    clientId?: string;
    organizationId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: SortOrder;
    searchQuery?: string;
} & Record<string, string | number | boolean | string[]>;

/**
 * Type guard for validating API responses
 */
export function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
    return (
        typeof response === 'object' &&
        response !== null &&
        'data' in response &&
        'success' in response &&
        'statusCode' in response
    );
}

/**
 * Type guard for validating API errors
 */
export function isApiError(error: unknown): error is ApiError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        'statusCode' in error &&
        'errorCode' in error
    );
}

/**
 * Helper function to create base API headers with auth token
 */
export function createApiHeaders(tokens?: AuthTokens): ApiHeaders {
    const headers: ApiHeaders = {
        'Content-Type': ContentType.APPLICATION_JSON,
        'X-Request-Id': crypto.randomUUID()
    };

    if (tokens?.accessToken) {
        headers['Authorization'] = `${tokens.tokenType} ${tokens.accessToken}`;
    }

    return headers;
}

/**
 * Helper function to create pagination query parameters
 */
export function createPaginationParams(params: Partial<PaginationParams>): QueryParams {
    return {
        page: params.page ?? 1,
        limit: params.limit ?? 10,
        sortBy: params.sortBy,
        order: params.order,
        clientId: params.clientId,
        organizationId: params.organizationId,
        searchQuery: params.searchQuery,
        ...params.filters
    };
}