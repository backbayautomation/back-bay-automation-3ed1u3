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
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Interface for enhanced API error responses with tracking
 */
export interface ApiError {
  message: string;
  statusCode: number;
  errors: string[];
  errorCode: string;
  requestId: string;
  metadata: Record<string, unknown>;
  timestamp?: string;
  path?: string;
}

/**
 * Extended Axios request configuration with security options
 */
export interface ApiRequestConfig extends AxiosRequestConfig {
  requiresAuth: boolean;
  skipErrorHandler: boolean;
  clientId?: string;
  organizationId?: string;
  securityHeaders: Record<string, string>;
  timeout: number;
  validateStatus?: (status: number) => boolean;
  retryAttempts?: number;
  retryDelay?: number;
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
  filters: Record<string, string>;
}

/**
 * Type for custom API headers with security considerations
 */
export type ApiHeaders = {
  'Content-Type': ContentType;
  'Authorization'?: string;
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
  [key: string]: string | number | boolean | string[] | undefined;
};

/**
 * Default API request configuration
 */
export const DEFAULT_API_CONFIG: Partial<ApiRequestConfig> = {
  timeout: 30000,
  requiresAuth: true,
  skipErrorHandler: false,
  securityHeaders: {},
  validateStatus: (status: number) => status >= 200 && status < 300,
  retryAttempts: 3,
  retryDelay: 1000,
} as const;

/**
 * Type guard for API response validation
 */
export function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    'data' in response &&
    'statusCode' in response
  );
}

/**
 * Type guard for API error validation
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
 * Helper type for API request methods with authentication
 */
export type AuthenticatedRequest = {
  headers: ApiHeaders;
  tokens: AuthTokens;
} & ApiRequestConfig;

/**
 * Helper type for paginated API responses
 */
export type PaginatedApiResponse<T> = ApiResponse<{
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}>;