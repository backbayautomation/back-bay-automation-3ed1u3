import axios, { AxiosRequestConfig } from 'axios'; // v1.5.0
import { z } from 'zod'; // v3.22.0
import { ApiResponse, Organization, PaginatedResponse } from '../types/common';

/**
 * API configuration for organization endpoints
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
 * Zod schema for validating organization data
 */
const organizationSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
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
    filters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

/**
 * Interface for request options with enhanced functionality
 */
interface RequestOptions {
    skipCache?: boolean;
    retryCount?: number;
    timeout?: number;
}

/**
 * Decorator for adding retry logic to API calls
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
                    if (i === retries - 1) break;
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
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
    const cache = new Map<string, { data: any; timestamp: number }>();
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const cacheKey = `${key}-${JSON.stringify(args)}`;
            const cached = cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < ttlSeconds * 1000) {
                return cached.data;
            }
            const result = await originalMethod.apply(this, args);
            cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        };
    };
}

/**
 * Decorator for metrics collection
 */
function withMetrics(operationName: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            const startTime = performance.now();
            try {
                const result = await originalMethod.apply(this, args);
                const duration = performance.now() - startTime;
                // Send metrics to monitoring system
                console.info(`${operationName} completed in ${duration}ms`);
                return result;
            } catch (error) {
                // Log error metrics
                console.error(`${operationName} failed:`, error);
                throw error;
            }
        };
    };
}

/**
 * Retrieves a paginated list of organizations with enhanced functionality
 * @param params - Pagination and filtering parameters
 * @param options - Request options for caching and retries
 * @returns Promise with paginated organization list
 */
@withRetry(3)
@withCache('organizations', 300)
@withMetrics('get_organizations')
export async function getOrganizations(
    params: z.infer<typeof paginationSchema>,
    options: RequestOptions = {}
): Promise<ApiResponse<PaginatedResponse<Organization>>> {
    try {
        // Validate pagination parameters
        const validatedParams = paginationSchema.parse(params);

        // Prepare request configuration
        const config: AxiosRequestConfig = {
            ...API_CONFIG,
            params: validatedParams,
            timeout: options.timeout || API_CONFIG.timeout,
            headers: {
                ...API_CONFIG.headers,
                'X-Request-ID': crypto.randomUUID(),
                'X-Skip-Cache': options.skipCache ? 'true' : 'false'
            }
        };

        // Make API request
        const response = await axios.get<ApiResponse<PaginatedResponse<Organization>>>(
            '/organizations',
            config
        );

        // Validate response data
        const validatedOrganizations = response.data.data.items.map(org => 
            organizationSchema.parse(org)
        );

        return {
            ...response.data,
            data: {
                ...response.data.data,
                items: validatedOrganizations
            }
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw {
                success: false,
                error: error.response?.data?.error || 'Failed to fetch organizations',
                statusCode: error.response?.status || 500,
                message: error.message,
                metadata: {
                    requestId: error.config?.headers?.['X-Request-ID'],
                    timestamp: new Date().toISOString()
                }
            };
        }
        throw error;
    }
}