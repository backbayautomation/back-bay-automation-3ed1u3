/**
 * TypeScript type definitions for authentication and authorization.
 * Provides comprehensive type safety for user authentication, token management,
 * role-based access control, and multi-tenant data structures.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { Organization } from '../types/common';

/**
 * Branded type for user IDs to ensure type safety
 */
export type UserId = string & { readonly __brand: unique symbol };

/**
 * Branded type for validated email addresses
 */
export type EmailAddress = string & { readonly __brand: unique symbol };

/**
 * Enum for strictly typed user role types in the system
 */
export enum UserRole {
    SYSTEM_ADMIN = 'SYSTEM_ADMIN',
    CLIENT_ADMIN = 'CLIENT_ADMIN',
    REGULAR_USER = 'REGULAR_USER'
}

/**
 * Interface for OAuth2/JWT authentication token response with strict validation
 */
export interface AuthTokens {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresIn: number;
    readonly tokenType: string;
}

/**
 * Interface for validated user login request payload
 */
export interface LoginCredentials {
    email: EmailAddress;
    password: string;
}

/**
 * Interface for authenticated user profile with strict multi-tenant validation
 */
export interface UserProfile {
    readonly id: UserId;
    readonly email: EmailAddress;
    readonly fullName: string;
    readonly role: UserRole;
    readonly isActive: boolean;
    readonly orgId: string;
    readonly clientId: string | null;
    readonly organization: Organization;
}

/**
 * Interface for immutable authentication state management
 */
export interface AuthState {
    readonly isAuthenticated: boolean;
    readonly isLoading: boolean;
    readonly user: UserProfile | null;
    readonly tokens: AuthTokens | null;
    readonly error: string | null;
}

/**
 * Configuration constants for token management
 */
export const TOKEN_CONFIG = {
    ACCESS_TOKEN_EXPIRY: 3600, // 1 hour in seconds
    REFRESH_TOKEN_EXPIRY: 2592000, // 30 days in seconds
    TOKEN_TYPE: 'Bearer'
} as const;

/**
 * Zod schema for runtime validation of AuthTokens
 */
export const authTokensSchema = z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresIn: z.number().positive(),
    tokenType: z.literal('Bearer')
});

/**
 * Zod schema for runtime validation of LoginCredentials
 */
export const loginCredentialsSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});

/**
 * Zod schema for runtime validation of UserProfile
 */
export const userProfileSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string().min(1),
    role: z.nativeEnum(UserRole),
    isActive: z.boolean(),
    orgId: z.string().uuid(),
    clientId: z.string().uuid().nullable(),
    organization: z.object({
        id: z.string().uuid(),
        name: z.string().min(1)
    })
});

/**
 * Type guard for validating user roles
 */
export function isUserRole(role: unknown): role is UserRole {
    return typeof role === 'string' && Object.values(UserRole).includes(role as UserRole);
}

/**
 * Type guard for validating auth tokens
 */
export function isAuthTokens(tokens: unknown): tokens is AuthTokens {
    return authTokensSchema.safeParse(tokens).success;
}

/**
 * Type guard for validating user profile
 */
export function isUserProfile(profile: unknown): profile is UserProfile {
    return userProfileSchema.safeParse(profile).success;
}

/**
 * Type guard for validating login credentials
 */
export function isLoginCredentials(credentials: unknown): credentials is LoginCredentials {
    return loginCredentialsSchema.safeParse(credentials).success;
}