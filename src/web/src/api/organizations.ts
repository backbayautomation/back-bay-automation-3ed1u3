/**
 * Organizations API Module
 * Provides CRUD operations for organization management in multi-tenant system
 * @version 1.0.0
 */

import axios, { AxiosRequestConfig } from 'axios'; // v1.5.0
import { z } from 'zod'; // v3.22.0
import { 
    ApiResponse, 
    Organization, 
    PaginatedResponse, 
    UUID,
    PaginationParams 
} from '../types/common';

/**
 * API configuration with retry and timeout settings
 */
const API_CONFIG: AxiosRequestConfig = {
    baseURL: '/api/v1',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0'
    }
};

/**
 * Zod schema for organization data validation
 */
const organizationSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    settings: z.record(z.unknown()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    metadata: z.record(z.unknown())
});

/**
 * Pagination parameters validation schema
 */
const paginationSchema = z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    filters: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

/**
 * Interface for request options with enhanced metadata
 */
interface RequestOptions {
    trackingId?: string;
    skipCache?: boolean;
    priority?: 'high' | 'normal' | 'low';
}

/**
 * Decorator for request retry logic
 */
function withRetry(retries: number) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            let lastError: Error;
            for (let i = 0; i < retries; i++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    lastError = error as Error;
                    if (!isRetryableError(error)) {
                        throw error;
                    }
                    await delay(Math.pow(2, i) * 1000); // Exponential backoff
                }
            }
            throw lastError!;
        };
    };
}

/**
 * Decorator for response caching
 */
function withCache(key: string, ttlSeconds: number) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const cacheKey = `${key}:${JSON.stringify(args)}`;
            const cached = await getCacheItem(cacheKey);
            if (cached) {
                return cached;
            }
            const result = await originalMethod.apply(this, args);
            await setCacheItem(cacheKey, result, ttlSeconds);
            return result;
        };
    };
}

/**
 * Decorator for request metrics tracking
 */
function withMetrics(operationName: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const startTime = performance.now();
            try {
                const result = await originalMethod.apply(this, args);
                recordMetrics(operationName, 'success', performance.now() - startTime);
                return result;
            } catch (error) {
                recordMetrics(operationName, 'error', performance.now() - startTime);
                throw error;
            }
        };
    };
}

/**
 * Retrieves a paginated list of organizations with enhanced error handling and monitoring
 * @param params Pagination and filtering parameters
 * @param options Request options for tracking and caching
 * @returns Promise with paginated organization list
 */
@withRetry(3)
@withCache('organizations', 300)
@withMetrics('get_organizations')
export async function getOrganizations(
    params: PaginationParams,
    options: RequestOptions = {}
): Promise<ApiResponse<PaginatedResponse<Organization>>> {
    try {
        // Validate pagination parameters
        const validatedParams = paginationSchema.parse(params);

        // Prepare request configuration
        const config: AxiosRequestConfig = {
            ...API_CONFIG,
            params: validatedParams,
            headers: {
                ...API_CONFIG.headers,
                'X-Request-ID': options.trackingId || generateRequestId(),
                'X-Request-Priority': options.priority || 'normal'
            }
        };

        // Make API request
        const response = await axios.get<ApiResponse<PaginatedResponse<Organization>>>(
            '/organizations',
            config
        );

        // Validate response data
        const validatedData = organizationSchema.array().parse(response.data.data.items);

        return {
            success: true,
            data: {
                ...response.data.data,
                items: validatedData
            },
            error: null,
            message: null,
            statusCode: response.status,
            metadata: {
                requestId: config.headers['X-Request-ID'],
                timestamp: new Date().toISOString()
            }
        };
    } catch (error) {
        return handleApiError(error);
    }
}

// Utility functions

function isRetryableError(error: any): boolean {
    return (
        axios.isAxiosError(error) &&
        error.response?.status !== undefined &&
        [408, 429, 500, 502, 503, 504].includes(error.response.status)
    );
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getCacheItem(key: string): Promise<any> {
    // Implementation would depend on caching strategy (localStorage, Redis, etc.)
    return null;
}

async function setCacheItem(key: string, value: any, ttl: number): Promise<void> {
    // Implementation would depend on caching strategy
}

function recordMetrics(operation: string, status: string, duration: number): void {
    // Implementation would depend on monitoring system
    console.debug(`Metrics - Operation: ${operation}, Status: ${status}, Duration: ${duration}ms`);
}

function handleApiError(error: any): ApiResponse<any> {
    if (axios.isAxiosError(error)) {
        return {
            success: false,
            data: null,
            error: error.response?.data?.error || error.message,
            message: 'API request failed',
            statusCode: error.response?.status || 500,
            metadata: {
                errorCode: error.code,
                timestamp: new Date().toISOString()
            }
        };
    }
    return {
        success: false,
        data: null,
        error: 'Unknown error occurred',
        message: error.message || 'Internal error',
        statusCode: 500,
        metadata: {
            timestamp: new Date().toISOString()
        }
    };
}