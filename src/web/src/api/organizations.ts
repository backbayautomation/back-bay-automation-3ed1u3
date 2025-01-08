import axios, { AxiosError } from 'axios'; // v1.5.0
import { z } from 'zod'; // v3.22.0
import { ApiResponse, Organization, PaginatedResponse } from '../types/common';

/**
 * Configuration for API requests with retry and timeout settings
 */
const API_CONFIG = {
  baseURL: '/api/v1',
  timeout: 5000,
  retries: 3,
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
 * Zod schema for pagination parameters
 */
const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  filters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

/**
 * Interface for request options with enhanced functionality
 */
interface RequestOptions {
  skipCache?: boolean;
  priority?: 'high' | 'normal' | 'low';
  signal?: AbortSignal;
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
          if (error instanceof AxiosError && error.response?.status >= 500) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            continue;
          }
          throw error;
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
      const options = args[1] as RequestOptions;
      if (options?.skipCache) {
        return await originalMethod.apply(this, args);
      }

      const cacheKey = `${key}-${JSON.stringify(args[0])}`;
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
 * @param options - Request options for caching and abort control
 * @returns Promise with paginated organization list
 */
@withRetry(API_CONFIG.retries)
@withCache('organizations', 300)
@withMetrics('get_organizations')
export async function getOrganizations(
  params: z.infer<typeof paginationSchema>,
  options?: RequestOptions
): Promise<ApiResponse<PaginatedResponse<Organization>>> {
  try {
    // Validate pagination parameters
    const validatedParams = paginationSchema.parse(params);

    // Prepare request configuration
    const requestConfig = {
      ...API_CONFIG,
      params: validatedParams,
      signal: options?.signal,
      headers: {
        ...API_CONFIG.headers,
        'X-Request-Priority': options?.priority || 'normal'
      }
    };

    // Make API request
    const response = await axios.get<ApiResponse<PaginatedResponse<Organization>>>(
      '/organizations',
      requestConfig
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
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.message}`);
    }
    if (error instanceof AxiosError) {
      throw new Error(`API error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Type guard to check if a response is an organization response
 */
export function isOrganizationResponse(
  response: unknown
): response is ApiResponse<Organization> {
  try {
    return (
      response !== null &&
      typeof response === 'object' &&
      'success' in response &&
      'data' in response &&
      organizationSchema.safeParse((response as any).data).success
    );
  } catch {
    return false;
  }
}