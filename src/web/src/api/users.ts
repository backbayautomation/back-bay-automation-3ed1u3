/**
 * User management API module implementing secure CRUD operations with multi-tenant support,
 * role-based access control, and comprehensive error handling.
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.5.0
import rateLimit from 'axios-rate-limit'; // v1.3.0
import axiosRetry from 'axios-retry'; // v3.8.0
import createError from 'http-errors'; // v2.0.0

import { ApiResponse, ApiError, PaginationParams, DEFAULT_API_CONFIG } from './types';
import { User, UserCreateInput, UserUpdateInput, UserRole } from '../types/user';

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
    RATE_LIMIT_EXCEEDED: 'Too many requests'
} as const;

/**
 * Interface for user filtering options
 */
interface UserFilterOptions {
    organizationId?: string;
    clientId?: string;
    role?: UserRole;
    isActive?: boolean;
    searchQuery?: string;
}

/**
 * Create and configure axios instance with retry and rate limiting
 */
const apiClient: AxiosInstance = rateLimit(
    axios.create({
        ...DEFAULT_API_CONFIG,
        baseURL: API_CONFIG.baseURL
    }),
    { 
        maxRequests: API_CONFIG.rateLimit.maxRequests,
        perMilliseconds: API_CONFIG.rateLimit.perMilliseconds
    }
);

// Configure automatic retries
axiosRetry(apiClient, {
    retries: API_CONFIG.retryAttempts,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               (error.response?.status === 429);
    }
});

/**
 * User management API functions
 */
export const userApi = {
    /**
     * Retrieve paginated list of users with filtering options
     */
    async getUsers(
        params: PaginationParams,
        filters: UserFilterOptions
    ): Promise<ApiResponse<User[]>> {
        try {
            const response = await apiClient.get('/api/v1/users', {
                params: {
                    ...params,
                    ...filters
                }
            });
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Retrieve user by ID with tenant validation
     */
    async getUserById(
        userId: string,
        organizationId: string
    ): Promise<ApiResponse<User>> {
        try {
            const response = await apiClient.get(`/api/v1/users/${userId}`, {
                headers: {
                    'X-Organization-Id': organizationId
                }
            });
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Create new user with role-based validation
     */
    async createUser(
        userData: UserCreateInput,
        organizationId: string
    ): Promise<ApiResponse<User>> {
        try {
            const response = await apiClient.post('/api/v1/users', userData, {
                headers: {
                    'X-Organization-Id': organizationId
                }
            });
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Update existing user with permission validation
     */
    async updateUser(
        userId: string,
        userData: UserUpdateInput,
        organizationId: string
    ): Promise<ApiResponse<User>> {
        try {
            const response = await apiClient.put(
                `/api/v1/users/${userId}`,
                userData,
                {
                    headers: {
                        'X-Organization-Id': organizationId
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Delete user with role validation
     */
    async deleteUser(
        userId: string,
        organizationId: string
    ): Promise<ApiResponse<void>> {
        try {
            const response = await apiClient.delete(`/api/v1/users/${userId}`, {
                headers: {
                    'X-Organization-Id': organizationId
                }
            });
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Standardized error handling for user API requests
     */
    private handleApiError(error: unknown): Error {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data as ApiError;

            switch (status) {
                case 401:
                    return createError(401, ERROR_MESSAGES.UNAUTHORIZED);
                case 403:
                    return createError(403, ERROR_MESSAGES.UNAUTHORIZED);
                case 404:
                    return createError(404, ERROR_MESSAGES.USER_NOT_FOUND);
                case 429:
                    return createError(429, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
                default:
                    return createError(
                        status || 500,
                        data?.message || 'An unexpected error occurred'
                    );
            }
        }
        return createError(500, 'An unexpected error occurred');
    }
};

export default userApi;