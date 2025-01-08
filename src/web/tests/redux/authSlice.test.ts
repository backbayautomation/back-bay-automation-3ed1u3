import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.7.0
import reducer, {
    loginUser,
    logoutUser,
    refreshToken,
    getCurrentUser,
    setLoading,
    clearAuth,
    setSessionTimeout,
    updateOrganizationContext
} from '../../src/redux/slices/authSlice';
import type { AuthState } from '../../src/types/auth';

// Mock secure storage
jest.mock('@secure-storage/browser', () => ({
    SecureStorage: jest.fn().mockImplementation(() => ({
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
    }))
}));

// Mock auth service
jest.mock('../../src/services/auth', () => ({
    AuthService: {
        authenticateUser: jest.fn(),
        validateTokenIntegrity: jest.fn(),
        logAuthEvent: jest.fn(),
        refreshAuthToken: jest.fn(),
        getCurrentUser: jest.fn(),
        logout: jest.fn()
    }
}));

// Mock encryption service
jest.mock('@crypto/encryption', () => ({
    encryptData: jest.fn(),
    decryptData: jest.fn()
}));

describe('Auth Slice', () => {
    let store: ReturnType<typeof configureStore>;

    beforeEach(() => {
        store = configureStore({
            reducer: { auth: reducer }
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initial State', () => {
        test('should return the initial state with security defaults', () => {
            const state = store.getState().auth;
            expect(state).toEqual({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                tokens: null,
                error: null,
                organization: null,
                sessionTimeout: null
            });
        });
    });

    describe('Login Flow', () => {
        const mockCredentials = {
            email: 'test@example.com',
            password: 'securePassword123'
        };

        const mockSuccessResponse = {
            user: {
                id: '123',
                email: 'test@example.com',
                role: 'CLIENT_ADMIN',
                orgId: 'org123'
            },
            tokens: {
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
                expiresIn: 3600,
                tokenType: 'Bearer'
            },
            organization: {
                id: 'org123',
                name: 'Test Org'
            }
        };

        test('should handle successful login with MFA validation', async () => {
            const mockAuthService = require('../../src/services/auth').AuthService;
            mockAuthService.authenticateUser.mockResolvedValue(mockSuccessResponse);
            mockAuthService.validateTokenIntegrity.mockReturnValue(true);

            await store.dispatch(loginUser(mockCredentials));
            const state = store.getState().auth;

            expect(state.isAuthenticated).toBe(true);
            expect(state.user).toEqual(mockSuccessResponse.user);
            expect(state.tokens).toEqual(mockSuccessResponse.tokens);
            expect(state.organization).toEqual(mockSuccessResponse.organization);
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith('login_success', expect.any(Object));
        });

        test('should handle login failure with rate limiting', async () => {
            const mockAuthService = require('../../src/services/auth').AuthService;
            mockAuthService.authenticateUser.mockRejectedValue(new Error('Rate limit exceeded'));

            await store.dispatch(loginUser(mockCredentials));
            const state = store.getState().auth;

            expect(state.isAuthenticated).toBe(false);
            expect(state.error).toBe('Rate limit exceeded');
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith('login_failure', expect.any(Object));
        });

        test('should validate token integrity during login', async () => {
            const mockAuthService = require('../../src/services/auth').AuthService;
            mockAuthService.authenticateUser.mockResolvedValue(mockSuccessResponse);
            mockAuthService.validateTokenIntegrity.mockReturnValue(false);

            await store.dispatch(loginUser(mockCredentials));
            const state = store.getState().auth;

            expect(state.isAuthenticated).toBe(false);
            expect(state.error).toBe('Token integrity validation failed');
        });
    });

    describe('Token Refresh', () => {
        const mockNewTokens = {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
        };

        test('should handle successful token refresh with encryption', async () => {
            const mockAuthService = require('../../src/services/auth').AuthService;
            mockAuthService.refreshAuthToken.mockResolvedValue(mockNewTokens);
            mockAuthService.validateTokenIntegrity.mockReturnValue(true);

            await store.dispatch(refreshToken());
            const state = store.getState().auth;

            expect(state.tokens).toEqual(mockNewTokens);
            expect(state.error).toBeNull();
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith('token_refresh_success', expect.any(Object));
        });

        test('should handle token refresh failure with retry', async () => {
            const mockAuthService = require('../../src/services/auth').AuthService;
            mockAuthService.refreshAuthToken.mockRejectedValue(new Error('Refresh failed'));

            await store.dispatch(refreshToken());
            const state = store.getState().auth;

            expect(state.isAuthenticated).toBe(false);
            expect(state.tokens).toBeNull();
            expect(state.error).toBe('Refresh failed');
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith('token_refresh_failure', expect.any(Object));
        });
    });

    describe('Logout Flow', () => {
        test('should handle secure logout with session cleanup', async () => {
            const mockAuthService = require('../../src/services/auth').AuthService;
            mockAuthService.logout.mockResolvedValue(undefined);

            await store.dispatch(logoutUser());
            const state = store.getState().auth;

            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.tokens).toBeNull();
            expect(state.organization).toBeNull();
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith('logout_success', expect.any(Object));
        });
    });

    describe('Organization Context', () => {
        test('should update organization context', () => {
            const mockOrg = {
                id: 'org123',
                name: 'Test Org'
            };

            store.dispatch(updateOrganizationContext(mockOrg));
            const state = store.getState().auth;

            expect(state.organization).toEqual(mockOrg);
        });
    });

    describe('Session Management', () => {
        test('should handle session timeout updates', () => {
            const timeout = 3600000; // 1 hour in milliseconds
            store.dispatch(setSessionTimeout(timeout));
            const state = store.getState().auth;

            expect(state.sessionTimeout).toBe(timeout);
        });

        test('should clear auth state on session expiry', () => {
            store.dispatch(clearAuth());
            const state = store.getState().auth;

            expect(state.isAuthenticated).toBe(false);
            expect(state.user).toBeNull();
            expect(state.tokens).toBeNull();
            expect(state.organization).toBeNull();
            expect(state.sessionTimeout).toBeNull();
        });
    });

    describe('Loading State', () => {
        test('should handle loading state updates', () => {
            store.dispatch(setLoading(true));
            let state = store.getState().auth;
            expect(state.isLoading).toBe(true);

            store.dispatch(setLoading(false));
            state = store.getState().auth;
            expect(state.isLoading).toBe(false);
        });
    });
});