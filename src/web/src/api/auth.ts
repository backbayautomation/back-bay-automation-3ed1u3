/**
 * Authentication API service module implementing OAuth 2.0 + OIDC authentication
 * with comprehensive security controls and monitoring features.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // v1.5.0
import * as CryptoJS from 'crypto-js'; // v4.1.1
import rax from 'retry-axios'; // v3.0.0
import { SecurityConfig } from '@security/config'; // v1.0.0
import { AuthLogger } from '@logging/auth'; // v1.0.0
import {
    LoginCredentials,
    AuthTokens,
    UserProfile,
    authTokensSchema,
    TOKEN_CONFIG,
    isAuthTokens,
    createEmailAddress
} from '../types/auth';
import { ApiResponse } from '../types/common';

// Security constants
const ENCRYPTION_KEY_SIZE = 256;
const TOKEN_REFRESH_THRESHOLD = 300; // 5 minutes in seconds
const MAX_RETRY_ATTEMPTS = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * Decorator for rate limiting authentication attempts
 */
function RateLimit(limit: number, window: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value;
        const rateLimiter = new Map<string, number[]>();

        descriptor.value = async function (...args: any[]) {
            const key = args[0]?.email || 'default';
            const now = Date.now();
            const windowMs = parseTimeWindow(window);
            
            const attempts = rateLimiter.get(key)?.filter(time => now - time < windowMs) || [];
            if (attempts.length >= limit) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            
            rateLimiter.set(key, [...attempts, now]);
            return original.apply(this, args);
        };
    };
}

/**
 * Decorator for audit logging of authentication events
 */
function AuditLog(eventType: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value;
        descriptor.value = async function (...args: any[]) {
            try {
                const result = await original.apply(this, args);
                this.logger?.log(eventType, { success: true, ...args[0] });
                return result;
            } catch (error) {
                this.logger?.log(eventType, { success: false, error: error.message, ...args[0] });
                throw error;
            }
        };
    };
}

/**
 * Core authentication service implementing secure authentication and token management
 */
@Injectable()
@MonitoredService('AuthService')
export class AuthService {
    private readonly apiClient: AxiosInstance;
    private readonly encryptionKey: string;
    private readonly circuitBreaker: CircuitBreaker;

    constructor(
        private readonly securityConfig: SecurityConfig,
        private readonly logger: AuthLogger
    ) {
        this.encryptionKey = this.generateEncryptionKey();
        this.circuitBreaker = new CircuitBreaker(CIRCUIT_BREAKER_THRESHOLD);
        this.apiClient = this.createSecureApiClient();
    }

    /**
     * Authenticates user with enhanced security features including MFA
     */
    @RateLimit(10, '1m')
    @AuditLog('auth:login')
    public async login(credentials: LoginCredentials): Promise<ApiResponse<AuthTokens>> {
        try {
            // Input validation and sanitization
            const validatedEmail = createEmailAddress(credentials.email);
            const sanitizedCredentials = {
                email: validatedEmail,
                password: this.encryptPassword(credentials.password),
                organizationId: credentials.organizationId,
                mfaToken: credentials.mfaToken
            };

            // Add security headers
            const headers = this.getSecurityHeaders();

            // Perform authentication request
            const response = await this.apiClient.post<ApiResponse<AuthTokens>>(
                '/auth/login',
                sanitizedCredentials,
                { headers }
            );

            // Validate response
            if (!isAuthTokens(response.data.data)) {
                throw new Error('Invalid token response format');
            }

            // Encrypt and store tokens
            const encryptedTokens = this.encryptTokens(response.data.data);
            this.storeTokens(encryptedTokens);

            return {
                success: true,
                data: encryptedTokens,
                error: null,
                message: 'Authentication successful',
                statusCode: 200,
                metadata: {}
            };
        } catch (error) {
            this.handleAuthError(error);
            throw error;
        }
    }

    /**
     * Securely refreshes access token with encryption and automatic retry
     */
    @CircuitBreaker(3, '1m')
    @AuditLog('auth:refresh')
    public async refreshToken(encryptedRefreshToken: string): Promise<ApiResponse<AuthTokens>> {
        try {
            const decryptedToken = this.decryptToken(encryptedRefreshToken);
            
            if (!this.isTokenValid(decryptedToken)) {
                throw new Error('Invalid refresh token');
            }

            const response = await this.apiClient.post<ApiResponse<AuthTokens>>(
                '/auth/refresh',
                { refreshToken: decryptedToken },
                { headers: this.getSecurityHeaders() }
            );

            const newTokens = this.encryptTokens(response.data.data);
            this.storeTokens(newTokens);

            return {
                success: true,
                data: newTokens,
                error: null,
                message: 'Token refresh successful',
                statusCode: 200,
                metadata: {}
            };
        } catch (error) {
            this.handleAuthError(error);
            throw error;
        }
    }

    /**
     * Validates token integrity and expiration
     */
    public async validateToken(encryptedToken: string): Promise<boolean> {
        try {
            const decryptedToken = this.decryptToken(encryptedToken);
            return this.isTokenValid(decryptedToken);
        } catch {
            return false;
        }
    }

    /**
     * Creates secure API client with interceptors and retry logic
     */
    private createSecureApiClient(): AxiosInstance {
        const client = axios.create({
            baseURL: this.securityConfig.apiBaseUrl,
            timeout: 10000,
            withCredentials: true
        });

        // Add retry logic
        client.defaults.raxConfig = {
            retry: MAX_RETRY_ATTEMPTS,
            retryDelay: this.calculateRetryDelay,
            statusCodesToRetry: [[408, 429, 500, 502, 503, 504]]
        };
        rax.attach(client);

        // Add security interceptors
        client.interceptors.request.use(this.addSecurityHeaders);
        client.interceptors.response.use(
            response => response,
            this.handleApiError
        );

        return client;
    }

    /**
     * Generates secure encryption key
     */
    private generateEncryptionKey(): string {
        return CryptoJS.lib.WordArray.random(ENCRYPTION_KEY_SIZE / 8).toString();
    }

    /**
     * Encrypts sensitive tokens
     */
    private encryptTokens(tokens: AuthTokens): AuthTokens {
        return {
            accessToken: this.encryptToken(tokens.accessToken),
            refreshToken: this.encryptToken(tokens.refreshToken),
            expiresIn: tokens.expiresIn,
            tokenType: tokens.tokenType
        };
    }

    /**
     * Encrypts individual token
     */
    private encryptToken(token: string): string {
        return CryptoJS.AES.encrypt(token, this.encryptionKey).toString();
    }

    /**
     * Decrypts token for validation
     */
    private decryptToken(encryptedToken: string): string {
        const bytes = CryptoJS.AES.decrypt(encryptedToken, this.encryptionKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    /**
     * Validates token expiration and integrity
     */
    private isTokenValid(token: string): boolean {
        try {
            const decoded = this.decodeToken(token);
            const now = Math.floor(Date.now() / 1000);
            return decoded.exp > now + TOKEN_REFRESH_THRESHOLD;
        } catch {
            return false;
        }
    }

    /**
     * Handles authentication errors with logging
     */
    private handleAuthError(error: any): void {
        this.logger.error('Authentication error', {
            error: error.message,
            code: error.response?.status
        });
        throw new Error(error.response?.data?.message || 'Authentication failed');
    }

    /**
     * Generates security headers for requests
     */
    private getSecurityHeaders(): Record<string, string> {
        return {
            'X-CSRF-Token': this.securityConfig.csrfToken,
            'X-Client-Version': process.env.APP_VERSION || '1.0.0',
            'X-Request-ID': crypto.randomUUID()
        };
    }

    /**
     * Calculates exponential backoff for retries
     */
    private calculateRetryDelay(retryCount: number): number {
        return Math.min(1000 * Math.pow(2, retryCount), 10000);
    }
}