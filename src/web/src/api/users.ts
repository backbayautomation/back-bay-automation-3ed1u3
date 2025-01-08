/**
 * API module for user management operations with multi-tenant support and RBAC.
 * Implements secure CRUD operations with comprehensive error handling.
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.5.0
import rateLimit from 'axios-rate-limit'; // v1.3.0
import axiosRetry from 'axios-retry'; // v3.8.0
import createError from 'http-errors'; // v2.0.0

import { ApiResponse, ApiError, PaginationParams, ApiHeaders } from './types';
import { User, UserRole, UserCreateInput, UserUpdateInput } from '../types/user';

/**
 * API configuration constants
 */
const API_CONFIG = {
    baseURL: process.env.REACT_APP_API_URL,
    timeout: 30000,
    retryAttempts: 3,
    rateLimit: {
        maxRequests: 100,
        perMilliseconds: 60000
    }
} as const;

/**
 * Error message constants
 */
const ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    UNAUTHORIZED: 'Unauthorized access',
    INVALID_ROLE: 'Invalid user role',
    RATE_LIMIT_EXCEEDED: 'Too many requests',
    NETWORK_ERROR: 'Network error occurred',
    VALIDATION_ERROR: 'Validation error'
} as const;

/**
 * Configure axios instance with retry and rate limiting
 */
const apiClient: AxiosInstance = rateLimit(
    axios.create({
        baseURL: API_CONFIG.baseURL,
        timeout: API_CONFIG.timeout,
        headers: {
            'Content-Type': 'application/json'
        }
    }),
    { maxRequests: API_CONFIG.rateLimit.maxRequests, perMilliseconds: API_CONFIG.rateLimit.perMilliseconds }
);

// Configure retry strategy
axiosRetry(apiClient, {
    retries: API_CONFIG.retryAttempts,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
    }
});

/**
 * User API interface implementation
 */
export const userApi = {
    /**
     * Retrieve paginated list of users with filtering
     */
    async getUsers(params: PaginationParams, filters: Record<string, string>): Promise<ApiResponse<User[]>> {
        try {
            const response = await apiClient.get('/api/v1/users', {
                params: {
                    ...params,
                    ...filters
                }
            });
            return response.data;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    /**
     * Retrieve user by ID with tenant validation
     */
    async getUserById(userId: string, orgId: string): Promise<ApiResponse<User>> {
        try {
            const response = await apiClient.get(`/api/v1/users/${userId}`, {
                headers: getSecurityHeaders(orgId)
            });
            return response.data;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    /**
     * Create new user with role validation
     */
    async createUser(userData: UserCreateInput, orgId: string): Promise<ApiResponse<User>> {
        try {
            validateUserRole(userData.role);
            const response = await apiClient.post('/api/v1/users', userData, {
                headers: getSecurityHeaders(orgId)
            });
            return response.data;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    /**
     * Update existing user with partial data
     */
    async updateUser(userId: string, userData: UserUpdateInput, orgId: string): Promise<ApiResponse<User>> {
        try {
            if (userData.role) {
                validateUserRole(userData.role);
            }
            const response = await apiClient.put(`/api/v1/users/${userId}`, userData, {
                headers: getSecurityHeaders(orgId)
            });
            return response.data;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    /**
     * Delete user with tenant validation
     */
    async deleteUser(userId: string, orgId: string): Promise<ApiResponse<void>> {
        try {
            const response = await apiClient.delete(`/api/v1/users/${userId}`, {
                headers: getSecurityHeaders(orgId)
            });
            return response.data;
        } catch (error) {
            throw handleApiError(error);
        }
    }
};

/**
 * Helper function to generate security headers
 */
function getSecurityHeaders(orgId: string): ApiHeaders {
    return {
        'Content-Type': 'application/json',
        'X-Organization-Id': orgId,
        'X-Request-Id': crypto.randomUUID()
    };
}

/**
 * Validate user role against allowed values
 */
function validateUserRole(role: UserRole): void {
    if (!Object.values(UserRole).includes(role)) {
        throw createError(400, ERROR_MESSAGES.INVALID_ROLE);
    }
}

/**
 * Standardized API error handler
 */
function handleApiError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const apiError = error.response?.data as ApiError;

        switch (status) {
            case 401:
                throw createError(401, ERROR_MESSAGES.UNAUTHORIZED);
            case 404:
                throw createError(404, ERROR_MESSAGES.USER_NOT_FOUND);
            case 429:
                throw createError(429, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
            default:
                throw createError(
                    status || 500,
                    apiError?.message || ERROR_MESSAGES.NETWORK_ERROR
                );
        }
    }
    throw error;
}

export default userApi;