/**
 * TypeScript type definitions and interfaces for user-related data structures.
 * Supports multi-tenant authentication, role-based access control, and user management.
 * @version 1.0.0
 */

import { BaseEntity } from './common';

/**
 * Enumeration of all possible user roles in the system.
 * Implements the four-tier role-based access control system.
 */
export enum UserRole {
    /**
     * Full system access with administrative capabilities
     */
    SYSTEM_ADMIN = 'SYSTEM_ADMIN',

    /**
     * Administrative access limited to specific client scope
     */
    CLIENT_ADMIN = 'CLIENT_ADMIN',

    /**
     * Standard user access with limited permissions
     */
    REGULAR_USER = 'REGULAR_USER',

    /**
     * Programmatic access for service integrations
     */
    API_SERVICE = 'API_SERVICE'
}

/**
 * Core user interface extending BaseEntity with user-specific fields.
 * Supports multi-tenant data model and role-based access control.
 */
export interface User extends BaseEntity {
    /**
     * Organization ID for multi-tenant isolation
     */
    orgId: string;

    /**
     * Optional client ID for client-specific users
     */
    clientId: string | null;

    /**
     * User's email address used for authentication
     */
    email: string;

    /**
     * User's full name for display purposes
     */
    fullName: string;

    /**
     * User's assigned role determining access permissions
     */
    role: UserRole;

    /**
     * Flag indicating if the user account is active
     */
    isActive: boolean;

    /**
     * Flag indicating if multi-factor authentication is enabled
     */
    mfaEnabled: boolean;

    /**
     * Timestamp of user's last successful login
     */
    lastLoginAt: string | null;
}

/**
 * Interface defining required fields for user creation.
 * Used in user registration and admin user creation flows.
 */
export interface UserCreateInput {
    /**
     * User's email address (must be unique)
     */
    email: string;

    /**
     * Initial password (must meet security requirements)
     */
    password: string;

    /**
     * User's full name
     */
    fullName: string;

    /**
     * Assigned role from UserRole enum
     */
    role: UserRole;

    /**
     * Optional client ID for client-specific users
     */
    clientId: string | null;

    /**
     * Flag to enable/disable MFA during creation
     */
    mfaEnabled: boolean;
}

/**
 * Interface for partial user updates with optional fields.
 * Supports granular updates without requiring all fields.
 */
export interface UserUpdateInput {
    /**
     * Updated email address (optional)
     */
    email?: string;

    /**
     * Updated full name (optional)
     */
    fullName?: string;

    /**
     * Updated role assignment (optional)
     */
    role?: UserRole;

    /**
     * Updated active status (optional)
     */
    isActive?: boolean;

    /**
     * Updated MFA status (optional)
     */
    mfaEnabled?: boolean;
}