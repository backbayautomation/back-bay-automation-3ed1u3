import { configureStore } from '@reduxjs/toolkit';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    reducer as authReducer,
    loginUser,
    logoutUser,
    refreshToken,
    getCurrentUser,
    actions
} from '../../src/redux/slices/authSlice';
import type { AuthState } from '../../src/types/auth';
import { UserRole } from '../../src/types/auth';

// Mock secure storage and encryption services
jest.mock('@secure-storage/browser', () => ({
    SecureStorage: jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn()
    }))
}));

// Mock crypto service
jest.mock('@crypto/encryption', () => ({
    encryptData: jest.fn(),
    decryptData: jest.fn()
}));

// Mock auth service with enhanced security features
const mockAuthService = {
    authenticateUser: jest.fn(),
    secureTokenRefresh: jest.fn(),
    validateTokenIntegrity: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn()
};

// Mock rate limiter service
const mockRateLimiter = {
    checkLimit: jest.fn(),
    incrementAttempts: jest.fn(),
    resetAttempts: jest.fn()
};

// Mock audit logger service
const mockAuditLogger = {
    logEvent: jest.fn(),
    logError: jest.fn(),
    logWarning: jest.fn()
};

describe('Auth Slice', () => {
    let store: ReturnType<typeof configureStore>;

    beforeEach(() => {
        store = configureStore({
            reducer: { auth: authReducer }
        });
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('Initial State', () => {
        test('should have correct initial state with security properties', () => {
            const state = store.getState().auth;
            expect(state).toEqual({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                tokens: null,
                error: null,
                organizationId: null,
                mfaRequired: false,
                auditLog: []
            });
        });
    });

    describe('Login Flow', () => {
        const mockCredentials = {
            email: 'test@example.com',
            password: 'SecurePass123!'
        };

        const mockSuccessResponse = {
            user: {
                id: 'user-123',
                email: 'test@example.com',
                fullName: 'Test User',
                role: UserRole.CLIENT_ADMIN,
                orgId: 'org-123',
                organization: {
                    id: 'org-123',
                    name: 'Test Org'
                }
            },
            tokens: {
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
                expiresIn: 3600,
                tokenType: 'Bearer'
            }
        };

        test('should handle successful login with MFA validation', async () => {
            mockRateLimiter.checkLimit.mockResolvedValue(true);
            mockAuthService.authenticateUser.mockResolvedValue(mockSuccessResponse);
            mockAuthService.validateTokenIntegrity.mockReturnValue(true);

            const result = await store.dispatch(loginUser(mockCredentials));
            expect(result.type).toBe(loginUser.fulfilled.type);
            
            const state = store.getState().auth;
            expect(state.isAuthenticated).toBe(true);
            expect(state.user).toEqual(mockSuccessResponse.user);
            expect(state.tokens).toEqual(mockSuccessResponse.tokens);
            expect(state.organizationId).toBe(mockSuccessResponse.user.orgId);
            expect(mockAuditLogger.logEvent).toHaveBeenCalledWith('login_success', expect.any(Object));
        });

        test('should handle rate limiting during login', async () => {
            mockRateLimiter.checkLimit.mockResolvedValue(false);

            const result = await store.dispatch(loginUser(mockCredentials));
            expect(result.type).toBe(loginUser.rejected.type);
            expect(result.payload).toBe('Too many login attempts. Please try again later.');
            expect(mockAuditLogger.logWarning).toHaveBeenCalledWith('rate_limit_exceeded', expect.any(Object));
        });

        test('should handle invalid credentials', async () => {
            mockRateLimiter.checkLimit.mockResolvedValue(true);
            mockAuthService.authenticateUser.mockRejectedValue(new Error('Invalid credentials'));

            const result = await store.dispatch(loginUser(mockCredentials));
            expect(result.type).toBe(loginUser.rejected.type);
            expect(result.payload).toBe('Invalid credentials');
            expect(mockAuditLogger.logEvent).toHaveBeenCalledWith('login_failed', expect.any(Object));
        });
    });

    describe('Token Refresh', () => {
        const mockNewTokens = {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
        };

        test('should handle successful token refresh', async () => {
            mockAuthService.secureTokenRefresh.mockResolvedValue(mockNewTokens);
            mockAuthService.validateTokenIntegrity.mockReturnValue(true);

            const result = await store.dispatch(refreshToken());
            expect(result.type).toBe(refreshToken.fulfilled.type);
            expect(result.payload).toEqual(mockNewTokens);
            expect(mockAuditLogger.logEvent).toHaveBeenCalledWith('token_refresh_success', expect.any(Object));
        });

        test('should handle token refresh failure', async () => {
            mockAuthService.secureTokenRefresh.mockRejectedValue(new Error('Refresh failed'));

            const result = await store.dispatch(refreshToken());
            expect(result.type).toBe(refreshToken.rejected.type);
            expect(result.payload).toBe('Refresh failed');
            expect(mockAuditLogger.logError).toHaveBeenCalledWith('token_refresh_failed', expect.any(Object));
        });
    });

    describe('Logout Flow', () => {
        test('should handle successful logout with cleanup', async () => {
            // Set initial authenticated state
            store.dispatch(actions.logout());
            
            const state = store.getState().auth;
            expect(state).toEqual({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                tokens: null,
                error: null,
                organizationId: null,
                mfaRequired: false,
                auditLog: []
            });
            expect(mockAuthService.logout).toHaveBeenCalled();
            expect(mockAuditLogger.logEvent).toHaveBeenCalledWith('logout_success', expect.any(Object));
        });
    });

    describe('Organization Context', () => {
        test('should update organization context', () => {
            const orgContext = {
                orgId: 'org-123',
                name: 'Test Organization'
            };

            store.dispatch(actions.setOrganizationContext(orgContext));
            const state = store.getState().auth;
            expect(state.organizationId).toBe(orgContext.orgId);
        });
    });

    describe('Error Handling', () => {
        test('should clear error state', () => {
            store.dispatch(actions.clearError());
            const state = store.getState().auth;
            expect(state.error).toBeNull();
        });
    });

    describe('Session Management', () => {
        test('should handle session timeout update', () => {
            const timeout = Date.now() + 30 * 60 * 1000; // 30 minutes
            store.dispatch(actions.updateSessionTimeout(timeout));
            const state = store.getState().auth;
            expect(state.sessionTimeout).toBe(timeout);
        });
    });
});