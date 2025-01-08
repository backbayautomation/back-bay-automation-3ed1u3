import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'; // v29.7.0
import reducer, {
    loginUser,
    logoutUser,
    refreshToken,
    getCurrentUser,
    actions
} from '../../src/redux/slices/authSlice';
import { AuthState } from '../../src/types/auth';

// Mock secure storage and encryption services
jest.mock('@secure-storage/browser', () => ({
    SecureStorage: jest.fn().mockImplementation(() => ({
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
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
    validateTokenIntegrity: jest.fn(),
    logAuthEvent: jest.fn(),
    refreshAuthToken: jest.fn(),
    logoutUser: jest.fn()
};

jest.mock('../../src/services/auth', () => ({
    AuthService: jest.fn(() => mockAuthService)
}));

describe('Auth Slice', () => {
    let store: ReturnType<typeof configureStore>;

    beforeEach(() => {
        store = configureStore({
            reducer: { auth: reducer }
        });
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    describe('Initial State', () => {
        it('should have secure default state', () => {
            const state = store.getState().auth;
            expect(state).toEqual({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                tokens: null,
                error: null,
                organization: null,
                mfaRequired: false,
                auditLog: []
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
                id: 'user-123',
                email: 'test@example.com',
                fullName: 'Test User',
                role: 'CLIENT_ADMIN',
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

        it('should handle successful login with MFA', async () => {
            mockAuthService.authenticateUser.mockResolvedValueOnce(mockSuccessResponse);
            mockAuthService.validateTokenIntegrity.mockReturnValueOnce(true);

            const result = await store.dispatch(loginUser(mockCredentials));
            expect(result.type).toBe('auth/login/fulfilled');
            
            const state = store.getState().auth;
            expect(state.isAuthenticated).toBe(true);
            expect(state.user).toEqual(mockSuccessResponse.user);
            expect(state.tokens).toEqual(mockSuccessResponse.tokens);
            expect(state.organization).toEqual({
                id: mockSuccessResponse.user.orgId,
                name: mockSuccessResponse.user.organization.name
            });
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith({
                type: 'LOGIN_SUCCESS',
                userId: mockSuccessResponse.user.id,
                orgId: mockSuccessResponse.user.orgId
            });
        });

        it('should handle rate limiting during login', async () => {
            mockAuthService.authenticateUser.mockRejectedValueOnce(
                new Error('Rate limit exceeded')
            );

            const result = await store.dispatch(loginUser(mockCredentials));
            expect(result.type).toBe('auth/login/rejected');
            
            const state = store.getState().auth;
            expect(state.error).toEqual({
                message: 'Rate limit exceeded',
                code: 'AUTH_ERROR'
            });
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith({
                type: 'LOGIN_FAILURE',
                error: 'Rate limit exceeded'
            });
        });

        it('should validate token integrity during login', async () => {
            mockAuthService.authenticateUser.mockResolvedValueOnce(mockSuccessResponse);
            mockAuthService.validateTokenIntegrity.mockReturnValueOnce(false);

            const result = await store.dispatch(loginUser(mockCredentials));
            expect(result.type).toBe('auth/login/rejected');
            
            const state = store.getState().auth;
            expect(state.error).toEqual({
                message: 'Token integrity validation failed',
                code: 'AUTH_ERROR'
            });
        });
    });

    describe('Token Refresh', () => {
        const mockNewTokens = {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
        };

        it('should handle successful token refresh', async () => {
            mockAuthService.refreshAuthToken.mockResolvedValueOnce(mockNewTokens);
            mockAuthService.validateTokenIntegrity.mockReturnValueOnce(true);

            const result = await store.dispatch(refreshToken());
            expect(result.type).toBe('auth/refresh/fulfilled');
            
            const state = store.getState().auth;
            expect(state.tokens).toEqual(mockNewTokens);
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith({
                type: 'TOKEN_REFRESH_SUCCESS'
            });
        });

        it('should handle token refresh failure with retry', async () => {
            mockAuthService.refreshAuthToken.mockRejectedValue(
                new Error('Network error')
            );

            const result = await store.dispatch(refreshToken());
            expect(result.type).toBe('auth/refresh/rejected');
            
            const state = store.getState().auth;
            expect(state).toEqual({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                tokens: null,
                error: null,
                organization: null,
                mfaRequired: false,
                auditLog: []
            });
        });
    });

    describe('Logout Flow', () => {
        it('should handle secure logout with audit logging', async () => {
            // Set initial authenticated state
            store.dispatch(actions.loginUser.fulfilled(mockSuccessResponse, '', {}));
            
            const result = await store.dispatch(logoutUser());
            expect(result.type).toBe('auth/logout/fulfilled');
            
            const state = store.getState().auth;
            expect(state).toEqual({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                tokens: null,
                error: null,
                organization: null,
                mfaRequired: false,
                auditLog: []
            });
            expect(mockAuthService.logAuthEvent).toHaveBeenCalledWith({
                type: 'LOGOUT_SUCCESS'
            });
        });
    });

    describe('Organization Context', () => {
        it('should update organization context', () => {
            const mockOrg = {
                id: 'org-123',
                name: 'Test Org',
                settings: {}
            };

            store.dispatch(actions.updateOrganizationContext(mockOrg));
            const state = store.getState().auth;
            expect(state.organization).toEqual(mockOrg);
        });
    });

    describe('Error Handling', () => {
        it('should clear error state', () => {
            store.dispatch(actions.loginUser.rejected(null, '', {}, {
                message: 'Test error',
                code: 'TEST_ERROR'
            }));
            
            store.dispatch(actions.clearError());
            const state = store.getState().auth;
            expect(state.error).toBeNull();
        });
    });
});