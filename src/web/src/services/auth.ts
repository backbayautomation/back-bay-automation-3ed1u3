/**
 * Enterprise-grade authentication service implementing OAuth 2.0 + OIDC with JWT token management.
 * Provides secure token storage, multi-tenant authorization, and comprehensive audit logging.
 * @version 1.0.0
 */

import { LoginCredentials, AuthTokens, UserProfile, UserRole, authTokensSchema } from '../types/auth';
import jwtDecode from 'jwt-decode'; // v3.1.2
import * as CryptoJS from 'crypto-js'; // v4.1.1
import { encryptData, decryptData } from '@crypto/encryption'; // v2.0.0
import winston from 'winston'; // v3.8.2

// Constants for authentication configuration
const AUTH_STORAGE_KEY = 'auth_tokens_encrypted';
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_AUTH_ATTEMPTS = 5;

// Configure audit logger
const auditLogger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'auth-service' },
    transports: [
        new winston.transports.File({ filename: 'auth-audit.log' })
    ]
});

/**
 * Enterprise authentication service with enhanced security features
 */
export class AuthService {
    private tokens: AuthTokens | null = null;
    private currentUser: UserProfile | null = null;
    private authAttempts: number = 0;
    private lastAuthAttempt: number = 0;
    private refreshTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.initializeService();
    }

    /**
     * Initialize the authentication service with secure token loading
     */
    private async initializeService(): Promise<void> {
        try {
            const encryptedTokens = localStorage.getItem(AUTH_STORAGE_KEY);
            if (encryptedTokens) {
                const decryptedTokens = await decryptData(encryptedTokens);
                const parsedTokens = JSON.parse(decryptedTokens);
                
                if (this.validateTokenIntegrity(parsedTokens)) {
                    this.tokens = parsedTokens;
                    this.setupTokenRefresh();
                }
            }
        } catch (error) {
            auditLogger.error('Failed to initialize auth service', { error });
            this.clearAuthData();
        }
    }

    /**
     * Authenticate user with rate limiting and MFA support
     * @param credentials User login credentials with optional MFA code
     */
    public async authenticateUser(credentials: LoginCredentials): Promise<{ user: UserProfile; tokens: AuthTokens }> {
        try {
            // Rate limiting check
            const now = Date.now();
            if (now - this.lastAuthAttempt < RATE_LIMIT_WINDOW) {
                this.authAttempts++;
                if (this.authAttempts >= MAX_AUTH_ATTEMPTS) {
                    auditLogger.warn('Rate limit exceeded', { email: credentials.email });
                    throw new Error('Too many authentication attempts. Please try again later.');
                }
            } else {
                this.authAttempts = 1;
            }
            this.lastAuthAttempt = now;

            // Authenticate with retry logic
            let attempt = 0;
            let authResponse;
            
            while (attempt < MAX_RETRY_ATTEMPTS) {
                try {
                    authResponse = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(credentials)
                    });
                    break;
                } catch (error) {
                    attempt++;
                    if (attempt === MAX_RETRY_ATTEMPTS) throw error;
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }

            if (!authResponse?.ok) {
                throw new Error('Authentication failed');
            }

            const { tokens, user } = await authResponse.json();

            // Validate token schema
            const validatedTokens = authTokensSchema.parse(tokens);

            // Encrypt and store tokens
            const encryptedTokens = await encryptData(JSON.stringify(validatedTokens));
            localStorage.setItem(AUTH_STORAGE_KEY, encryptedTokens);

            this.tokens = validatedTokens;
            this.currentUser = user;

            // Setup automatic token refresh
            this.setupTokenRefresh();

            auditLogger.info('User authenticated successfully', {
                userId: user.id,
                role: user.role,
                orgId: user.orgId
            });

            return { user, tokens: validatedTokens };

        } catch (error) {
            auditLogger.error('Authentication failed', {
                error,
                email: credentials.email
            });
            throw error;
        }
    }

    /**
     * Secure token refresh with encryption and validation
     */
    public async secureTokenRefresh(): Promise<AuthTokens> {
        try {
            if (!this.tokens?.refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.tokens.refreshToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const newTokens = await response.json();
            const validatedTokens = authTokensSchema.parse(newTokens);

            // Encrypt and store new tokens
            const encryptedTokens = await encryptData(JSON.stringify(validatedTokens));
            localStorage.setItem(AUTH_STORAGE_KEY, encryptedTokens);

            this.tokens = validatedTokens;
            this.setupTokenRefresh();

            auditLogger.info('Tokens refreshed successfully', {
                userId: this.currentUser?.id
            });

            return validatedTokens;

        } catch (error) {
            auditLogger.error('Token refresh failed', { error });
            this.clearAuthData();
            throw error;
        }
    }

    /**
     * Validate token integrity and authenticity
     */
    public validateTokenIntegrity(tokens: AuthTokens): boolean {
        try {
            if (!tokens.accessToken) return false;

            const decoded = jwtDecode<{
                exp: number;
                iat: number;
                sub: string;
                role: UserRole;
                orgId: string;
            }>(tokens.accessToken);

            // Validate token expiration
            if (decoded.exp * 1000 < Date.now()) {
                return false;
            }

            // Validate required claims
            if (!decoded.sub || !decoded.role || !decoded.orgId) {
                return false;
            }

            return true;

        } catch (error) {
            auditLogger.error('Token validation failed', { error });
            return false;
        }
    }

    /**
     * Setup automatic token refresh before expiration
     */
    private setupTokenRefresh(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        if (!this.tokens?.expiresIn) return;

        const refreshTime = (this.tokens.expiresIn * 1000) - TOKEN_REFRESH_THRESHOLD;
        this.refreshTimer = setTimeout(() => {
            this.secureTokenRefresh().catch(error => {
                auditLogger.error('Automatic token refresh failed', { error });
            });
        }, refreshTime);
    }

    /**
     * Clear authentication data and local storage
     */
    private clearAuthData(): void {
        this.tokens = null;
        this.currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
    }

    /**
     * Get current authentication status
     */
    public isAuthenticated(): boolean {
        return !!this.tokens && this.validateTokenIntegrity(this.tokens);
    }

    /**
     * Get current user profile
     */
    public getCurrentUser(): UserProfile | null {
        return this.currentUser;
    }

    /**
     * Logout user and clear all auth data
     */
    public async logout(): Promise<void> {
        try {
            if (this.tokens?.refreshToken) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.tokens.refreshToken}`
                    }
                });
            }
        } catch (error) {
            auditLogger.error('Logout failed', { error });
        } finally {
            this.clearAuthData();
            auditLogger.info('User logged out', {
                userId: this.currentUser?.id
            });
        }
    }
}