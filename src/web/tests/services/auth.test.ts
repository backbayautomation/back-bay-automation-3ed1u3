import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockInstance } from 'jest-mock';
import { AuthService } from '../../src/services/auth';
import { LoginCredentials, AuthTokens } from '../../src/types/auth';
import crypto from 'crypto';

// Mock localStorage
const localStorageMock = (() => {
    let store: { [key: string]: string } = {};
    return {
        getItem: jest.fn((key: string) => store[key]),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        })
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch API
global.fetch = jest.fn();

// Test constants
const mockLoginCredentials: LoginCredentials = {
    email: 'test@example.com',
    password: 'password123',
    mfaToken: '123456'
};

const mockAuthTokens: AuthTokens = {
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
    expiresIn: 3600,
    tokenIntegrity: 'sha256-hash'
};

const mockEncryptionKey = 'test-encryption-key-32-bytes-secure';

describe('AuthService Security Tests', () => {
    let authService: AuthService;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        // Clear all mocks and localStorage
        jest.clearAllMocks();
        localStorageMock.clear();
        
        // Initialize fetch mock
        fetchMock = global.fetch as jest.Mock;
        
        // Initialize AuthService
        authService = new AuthService();
        
        // Mock crypto functions
        jest.spyOn(crypto, 'randomBytes').mockImplementation(() => Buffer.from(mockEncryptionKey));
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('Authentication Flow', () => {
        test('should successfully authenticate user with valid credentials and MFA', async () => {
            // Mock successful authentication response
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ tokens: mockAuthTokens, user: { id: '123', email: mockLoginCredentials.email } })
            });

            const result = await authService.authenticateUser(mockLoginCredentials);

            // Verify successful authentication
            expect(result).toBeDefined();
            expect(result.tokens).toEqual(mockAuthTokens);
            expect(result.user).toBeDefined();

            // Verify localStorage encryption
            expect(localStorageMock.setItem).toHaveBeenCalled();
            const storedData = localStorageMock.setItem.mock.calls[0][1];
            expect(storedData).toBeDefined();
            expect(typeof storedData).toBe('string');
        });

        test('should enforce rate limiting on multiple failed attempts', async () => {
            // Mock failed authentication response
            fetchMock.mockRejectedValue(new Error('Authentication failed'));

            // Attempt multiple logins
            const attempts = [];
            for (let i = 0; i < 6; i++) {
                attempts.push(authService.authenticateUser(mockLoginCredentials));
            }

            await expect(Promise.all(attempts)).rejects.toThrow('Too many authentication attempts');
        });

        test('should properly handle MFA validation', async () => {
            // Mock MFA validation
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ 
                    tokens: mockAuthTokens, 
                    user: { id: '123', email: mockLoginCredentials.email },
                    mfaVerified: true
                })
            });

            const result = await authService.authenticateUser({
                ...mockLoginCredentials,
                mfaToken: '123456'
            });

            expect(result.tokens).toBeDefined();
            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining('mfaToken')
                })
            );
        });
    });

    describe('Token Management', () => {
        test('should securely refresh tokens before expiration', async () => {
            // Setup initial auth state
            localStorageMock.setItem('auth_tokens_encrypted', JSON.stringify(mockAuthTokens));

            // Mock refresh token response
            const newTokens = { ...mockAuthTokens, accessToken: 'new.access.token' };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ tokens: newTokens })
            });

            const result = await authService.refreshAuthToken();

            expect(result).toEqual(newTokens);
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        test('should validate token integrity', () => {
            const validToken = {
                ...mockAuthTokens,
                tokenIntegrity: 'valid-hash'
            };

            const isValid = authService.validateTokenIntegrity(validToken);
            expect(isValid).toBe(true);
        });

        test('should detect tampered tokens', () => {
            const tamperedToken = {
                ...mockAuthTokens,
                tokenIntegrity: 'tampered-hash'
            };

            const isValid = authService.validateTokenIntegrity(tamperedToken);
            expect(isValid).toBe(false);
        });
    });

    describe('Security Features', () => {
        test('should properly encrypt and decrypt tokens', async () => {
            const originalToken = 'sensitive.token.data';
            
            // Test encryption
            const encrypted = await authService.encryptToken(originalToken);
            expect(encrypted).not.toBe(originalToken);
            expect(encrypted).toMatch(/^[a-zA-Z0-9+/]+={0,2}$/); // Base64 format

            // Test decryption
            const decrypted = await authService.decryptToken(encrypted);
            expect(decrypted).toBe(originalToken);
        });

        test('should handle encryption errors gracefully', async () => {
            // Mock encryption failure
            jest.spyOn(crypto, 'randomBytes').mockImplementationOnce(() => {
                throw new Error('Encryption failed');
            });

            await expect(authService.encryptToken('test')).rejects.toThrow('Encryption failed');
        });

        test('should clear sensitive data on logout', async () => {
            // Setup auth state
            localStorageMock.setItem('auth_tokens_encrypted', JSON.stringify(mockAuthTokens));
            
            await authService.logoutUser();

            expect(localStorageMock.removeItem).toHaveBeenCalled();
            expect(await authService.getCurrentUserProfile()).toBeNull();
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors during authentication', async () => {
            fetchMock.mockRejectedValueOnce(new Error('Network error'));

            await expect(authService.authenticateUser(mockLoginCredentials))
                .rejects.toThrow('Network error');
        });

        test('should handle invalid token responses', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ tokens: { ...mockAuthTokens, accessToken: null } })
            });

            await expect(authService.authenticateUser(mockLoginCredentials))
                .rejects.toThrow();
        });

        test('should handle server errors gracefully', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(authService.authenticateUser(mockLoginCredentials))
                .rejects.toThrow('Authentication failed');
        });
    });
});