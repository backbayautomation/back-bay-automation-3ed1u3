/**
 * API module for user management operations with multi-tenant support and RBAC.
 * Implements secure CRUD operations with comprehensive error handling.
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.5.0
import rateLimit from 'axios-rate-limit'; // v1.3.0
import axiosRetry from 'axios-retry'; // v3.8.0
import createError from 'http-errors'; // v2.0.0

import { ApiResponse, ApiError, PaginationParams, QueryParams, createApiHeaders } from './types';
import { User, UserCreateInput, UserUpdateInput, UserRole } from '../types/user';

// API Configuration Constants
const API_CONFIG = {
    baseURL: process.env.REACT_APP_API_URL,
    timeout: 30000,
    retryAttempts: 3,
    rateLimit: {
        maxRequests: 100,
        perMilliseconds: 60000
    }
} as const;

// Error Messages
const ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    UNAUTHORIZED: 'Unauthorized access',
    INVALID_ROLE: 'Invalid user role',
    RATE_LIMIT_EXCEEDED: 'Too many requests',
    NETWORK_ERROR: 'Network error occurred',
    VALIDATION_ERROR: 'Validation error'
} as const;

/**
 * Creates and configures the axios instance with retry and rate limiting
 */
const createApiClient = (): AxiosInstance => {
    const client = axios.create({
        baseURL: API_CONFIG.baseURL,
        timeout: API_CONFIG.timeout,
        headers: createApiHeaders()
    });

    // Configure rate limiting
    const rateLimitedClient = rateLimit(client, {
        maxRequests: API_CONFIG.rateLimit.maxRequests,
        perMilliseconds: API_CONFIG.rateLimit.perMilliseconds
    });

    // Configure retry logic
    axiosRetry(rateLimitedClient, {
        retries: API_CONFIG.retryAttempts,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: (error) => {
            return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                   error.response?.status === 429;
        }
    });

    return rateLimitedClient;
};

const apiClient = createApiClient();

/**
 * User management API interface with comprehensive CRUD operations
 */
export const userApi = {
    /**
     * Retrieves a paginated list of users with organization/client filtering
     */
    async getUsers(
        params: PaginationParams,
        filters?: Record<string, string>
    ): Promise<ApiResponse<User[]>> {
        try {
            const queryParams: QueryParams = {
                page: params.page,
                limit: params.limit,
                sortBy: params.sortBy,
                order: params.order,
                ...filters
            };

            const response = await apiClient.get<ApiResponse<User[]>>('/api/v1/users', {
                params: queryParams
            });

            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Retrieves a specific user by ID with proper authorization checks
     */
    async getUserById(userId: string): Promise<ApiResponse<User>> {
        try {
            const response = await apiClient.get<ApiResponse<User>>(`/api/v1/users/${userId}`);
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Creates a new user with role-based access control
     */
    async createUser(userData: UserCreateInput): Promise<ApiResponse<User>> {
        try {
            this.validateUserData(userData);
            const response = await apiClient.post<ApiResponse<User>>('/api/v1/users', userData);
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Updates an existing user with proper authorization checks
     */
    async updateUser(
        userId: string,
        userData: UserUpdateInput
    ): Promise<ApiResponse<User>> {
        try {
            this.validateUserData(userData);
            const response = await apiClient.put<ApiResponse<User>>(
                `/api/v1/users/${userId}`,
                userData
            );
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Deletes a user with proper authorization checks
     */
    async deleteUser(userId: string): Promise<ApiResponse<void>> {
        try {
            const response = await apiClient.delete<ApiResponse<void>>(`/api/v1/users/${userId}`);
            return response.data;
        } catch (error) {
            throw this.handleApiError(error);
        }
    },

    /**
     * Validates user data before sending to the API
     */
    private validateUserData(userData: Partial<UserCreateInput | UserUpdateInput>): void {
        if (userData.email && !this.isValidEmail(userData.email)) {
            throw createError(400, ERROR_MESSAGES.VALIDATION_ERROR, {
                code: 'INVALID_EMAIL'
            });
        }

        if (userData.role && !Object.values(UserRole).includes(userData.role)) {
            throw createError(400, ERROR_MESSAGES.INVALID_ROLE, {
                code: 'INVALID_ROLE'
            });
        }
    },

    /**
     * Handles API errors with specific error types and messages
     */
    private handleApiError(error: unknown): Error {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const apiError = error.response?.data as ApiError;

            switch (status) {
                case 401:
                    return createError(401, ERROR_MESSAGES.UNAUTHORIZED);
                case 404:
                    return createError(404, ERROR_MESSAGES.USER_NOT_FOUND);
                case 429:
                    return createError(429, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
                default:
                    return createError(
                        status || 500,
                        apiError?.message || ERROR_MESSAGES.NETWORK_ERROR
                    );
            }
        }
        return createError(500, ERROR_MESSAGES.NETWORK_ERROR);
    },

    /**
     * Validates email format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
};

export default userApi;