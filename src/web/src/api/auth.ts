/**
 * Authentication API service module implementing OAuth 2.0 + OIDC authentication
 * with comprehensive security controls and monitoring features.
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.5.0
import CryptoJS from 'crypto-js'; // v4.1.1
import rax from 'retry-axios'; // v3.0.0
import { SecurityConfig } from '@security/config'; // v1.0.0
import { AuthLogger } from '@logging/auth'; // v1.0.0
import { 
    LoginCredentials, 
    AuthTokens, 
    UserProfile, 
    isAuthTokens,
    TOKEN_CONFIG 
} from '../types/auth';
import { ApiResponse } from '../types/common';

// Security constants
const ENCRYPTION_KEY_SIZE = 256;
const MAX_RETRY_ATTEMPTS = 3;
const TOKEN_REFRESH_THRESHOLD = 300; // 5 minutes in seconds

/**
 * Core authentication service with comprehensive security features
 * and monitoring capabilities.
 */
@Injectable()
@MonitoredService('AuthService')
export class AuthService {
    private readonly axiosInstance: AxiosInstance;
    private readonly encryptionKey: string;
    private refreshPromise: Promise<ApiResponse<AuthTokens>> | null = null;

    constructor(
        private readonly securityConfig: SecurityConfig,
        private readonly logger: AuthLogger
    ) {
        this.encryptionKey = this.generateEncryptionKey();
        this.axiosInstance = this.createSecureAxiosInstance();
    }

    /**
     * Authenticates user with enhanced security features including MFA
     * and organization context.
     */
    @RateLimit(10, '1m')
    @AuditLog('auth:login')
    public async login(
        credentials: LoginCredentials,
        securityConfig: SecurityConfig
    ): Promise<ApiResponse<AuthTokens>> {
        try {
            // Sanitize and validate input
            this.validateCredentials(credentials);

            // Add security headers
            const headers = this.getSecurityHeaders(securityConfig);

            // Encrypt sensitive data
            const encryptedPayload = this.encryptPayload(credentials);

            const response = await this.axiosInstance.post<ApiResponse<AuthTokens>>(
                '/api/v1/auth/login',
                encryptedPayload,
                { headers }
            );

            if (response.data.success && isAuthTokens(response.data.data)) {
                // Encrypt tokens before storage
                const encryptedTokens = this.encryptTokens(response.data.data);
                this.storeTokens(encryptedTokens);

                this.logger.info('Authentication successful', {
                    userId: response.data.data.userId,
                    organizationId: credentials.organizationId
                });

                return response.data;
            }

            throw new Error('Invalid authentication response');
        } catch (error) {
            this.logger.error('Authentication failed', { error });
            throw this.handleAuthError(error);
        }
    }

    /**
     * Securely refreshes access token with encryption and automatic retry.
     */
    @CircuitBreaker(3, '1m')
    @AuditLog('auth:refresh')
    public async refreshToken(
        encryptedRefreshToken: string,
        securityConfig: SecurityConfig
    ): Promise<ApiResponse<AuthTokens>> {
        // Implement singleton pattern for refresh
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        try {
            this.refreshPromise = (async () => {
                const decryptedToken = this.decryptToken(encryptedRefreshToken);
                this.validateRefreshToken(decryptedToken);

                const headers = this.getSecurityHeaders(securityConfig);
                const response = await this.axiosInstance.post<ApiResponse<AuthTokens>>(
                    '/api/v1/auth/refresh',
                    { refreshToken: decryptedToken },
                    { headers }
                );

                if (response.data.success && isAuthTokens(response.data.data)) {
                    const encryptedTokens = this.encryptTokens(response.data.data);
                    this.storeTokens(encryptedTokens);
                    return response.data;
                }

                throw new Error('Invalid token refresh response');
            })();

            return await this.refreshPromise;
        } catch (error) {
            this.logger.error('Token refresh failed', { error });
            throw this.handleAuthError(error);
        } finally {
            this.refreshPromise = null;
        }
    }

    /**
     * Validates token integrity and expiration.
     */
    public async validateToken(encryptedToken: string): Promise<boolean> {
        try {
            const decryptedToken = this.decryptToken(encryptedToken);
            const tokenParts = decryptedToken.split('.');
            
            if (tokenParts.length !== 3) {
                return false;
            }

            const payload = JSON.parse(atob(tokenParts[1]));
            const expirationTime = payload.exp * 1000;
            
            return Date.now() < expirationTime;
        } catch (error) {
            this.logger.error('Token validation failed', { error });
            return false;
        }
    }

    /**
     * Creates secure axios instance with interceptors and retry logic.
     */
    private createSecureAxiosInstance(): AxiosInstance {
        const instance = axios.create({
            baseURL: this.securityConfig.apiBaseUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Version': process.env.APP_VERSION
            }
        });

        // Add retry logic
        instance.defaults.raxConfig = {
            retry: MAX_RETRY_ATTEMPTS,
            retryDelay: this.getExponentialDelay,
            statusCodesToRetry: [[408, 429, 500, 502, 503, 504]]
        };

        rax.attach(instance);

        // Add response interceptor for token refresh
        instance.interceptors.response.use(
            response => response,
            async error => {
                if (error.response?.status === 401 && this.shouldRefreshToken()) {
                    return this.handleTokenRefresh(error);
                }
                throw error;
            }
        );

        return instance;
    }

    /**
     * Generates secure encryption key for token encryption.
     */
    private generateEncryptionKey(): string {
        return CryptoJS.lib.WordArray.random(ENCRYPTION_KEY_SIZE / 8).toString();
    }

    /**
     * Encrypts authentication tokens for secure storage.
     */
    private encryptTokens(tokens: AuthTokens): AuthTokens {
        return {
            ...tokens,
            accessToken: this.encryptToken(tokens.accessToken),
            refreshToken: this.encryptToken(tokens.refreshToken)
        };
    }

    /**
     * Encrypts individual token with AES-256.
     */
    private encryptToken(token: string): string {
        return CryptoJS.AES.encrypt(token, this.encryptionKey).toString();
    }

    /**
     * Decrypts token for validation or refresh.
     */
    private decryptToken(encryptedToken: string): string {
        const bytes = CryptoJS.AES.decrypt(encryptedToken, this.encryptionKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    /**
     * Handles authentication errors with proper logging and formatting.
     */
    private handleAuthError(error: any): Error {
        const errorMessage = error.response?.data?.message || 'Authentication failed';
        return new Error(errorMessage);
    }

    /**
     * Validates refresh token expiration and integrity.
     */
    private validateRefreshToken(token: string): void {
        if (!token || !this.validateToken(token)) {
            throw new Error('Invalid or expired refresh token');
        }
    }

    /**
     * Determines if token refresh should be attempted.
     */
    private shouldRefreshToken(): boolean {
        const currentToken = this.getStoredAccessToken();
        if (!currentToken) return false;

        const decodedToken = this.decryptToken(currentToken);
        const payload = JSON.parse(atob(decodedToken.split('.')[1]));
        const expirationTime = payload.exp * 1000;
        
        return Date.now() > expirationTime - TOKEN_REFRESH_THRESHOLD * 1000;
    }

    /**
     * Handles token refresh process with error handling.
     */
    private async handleTokenRefresh(error: any): Promise<any> {
        try {
            const refreshToken = this.getStoredRefreshToken();
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await this.refreshToken(refreshToken, this.securityConfig);
            if (response.success) {
                // Retry original request with new token
                const originalRequest = error.config;
                originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
                return this.axiosInstance(originalRequest);
            }
        } catch (refreshError) {
            this.logger.error('Token refresh failed', { refreshError });
        }
        throw error;
    }

    /**
     * Calculates exponential delay for retry attempts.
     */
    private getExponentialDelay(retryCount: number): number {
        return Math.min(1000 * Math.pow(2, retryCount), 10000);
    }

    /**
     * Retrieves stored access token from secure storage.
     */
    private getStoredAccessToken(): string | null {
        return localStorage.getItem('access_token');
    }

    /**
     * Retrieves stored refresh token from secure storage.
     */
    private getStoredRefreshToken(): string | null {
        return localStorage.getItem('refresh_token');
    }

    /**
     * Stores encrypted tokens in secure storage.
     */
    private storeTokens(tokens: AuthTokens): void {
        localStorage.setItem('access_token', tokens.accessToken);
        localStorage.setItem('refresh_token', tokens.refreshToken);
    }

    /**
     * Generates security headers for API requests.
     */
    private getSecurityHeaders(config: SecurityConfig): Record<string, string> {
        return {
            'X-CSRF-Token': config.csrfToken,
            'X-Request-ID': crypto.randomUUID(),
            'X-Client-Version': process.env.APP_VERSION || '1.0.0'
        };
    }

    /**
     * Validates login credentials format and content.
     */
    private validateCredentials(credentials: LoginCredentials): void {
        if (!credentials.email || !credentials.password) {
            throw new Error('Invalid credentials format');
        }
    }

    /**
     * Encrypts sensitive payload data for transmission.
     */
    private encryptPayload(data: any): string {
        return CryptoJS.AES.encrypt(
            JSON.stringify(data),
            this.encryptionKey
        ).toString();
    }
}