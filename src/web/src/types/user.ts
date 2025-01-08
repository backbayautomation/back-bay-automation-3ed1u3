/**
 * TypeScript type definitions and interfaces for user-related data structures.
 * Supports multi-tenant authentication, role-based access control, and user management operations.
 * @version 1.0.0
 */

import { BaseEntity } from './common';

/**
 * Enumeration of all possible user roles in the system.
 * Implements the four-tier role-based access control system.
 */
export enum UserRole {
    /** Full system access with administrative capabilities */
    SYSTEM_ADMIN = 'SYSTEM_ADMIN',
    /** Administrative access limited to specific client scope */
    CLIENT_ADMIN = 'CLIENT_ADMIN',
    /** Standard user access with limited permissions */
    REGULAR_USER = 'REGULAR_USER',
    /** Programmatic access for service-to-service communication */
    API_SERVICE = 'API_SERVICE'
}

/**
 * Main user interface extending BaseEntity with comprehensive user properties.
 * Supports multi-tenant data model with organization and client relationships.
 */
export interface User extends BaseEntity {
    /** Organization ID for multi-tenant isolation */
    orgId: string;
    /** Optional client ID for client-specific users */
    clientId: string | null;
    /** User's email address used for authentication */
    email: string;
    /** User's full name for display purposes */
    fullName: string;
    /** User's assigned role determining access permissions */
    role: UserRole;
    /** Flag indicating if the user account is active */
    isActive: boolean;
    /** Flag indicating if multi-factor authentication is enabled */
    mfaEnabled: boolean;
    /** Timestamp of user's last successful login */
    lastLoginAt: string | null;
}

/**
 * Interface defining required fields for user creation operations.
 * Enforces mandatory fields and proper typing for new user registration.
 */
export interface UserCreateInput {
    /** User's email address (must be unique) */
    email: string;
    /** User's initial password (will be hashed) */
    password: string;
    /** User's full name */
    fullName: string;
    /** Assigned user role */
    role: UserRole;
    /** Optional client ID for client-specific users */
    clientId: string | null;
    /** Whether to enable MFA during creation */
    mfaEnabled: boolean;
}

/**
 * Interface defining optional fields for user update operations.
 * Supports partial updates with undefined fields being ignored.
 */
export interface UserUpdateInput {
    /** Updated email address */
    email?: string;
    /** Updated full name */
    fullName?: string;
    /** Updated user role */
    role?: UserRole;
    /** Updated active status */
    isActive?: boolean;
    /** Updated MFA status */
    mfaEnabled?: boolean;
}