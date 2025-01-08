/**
 * Enhanced Redux slice for secure authentication state management with multi-tenant support.
 * Implements OAuth 2.0 + OIDC with JWT tokens and comprehensive security features.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { SecureStorage } from '@secure-storage/browser'; // v1.2.0
import {
    AuthState,
    LoginCredentials,
    AuthTokens,
    UserProfile,
    OrganizationContext,
    AuthError
} from '../../types/auth';
import { AuthService } from '../../services/auth';

// Initialize secure storage and auth service
const secureStorage = new SecureStorage();
const authService = new AuthService();

// Initial state with enhanced security and multi-tenant support
const initialState: AuthState = {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    tokens: null,
    error: null,
    organization: null,
    sessionTimeout: null
};

/**
 * Enhanced async thunk for secure user login with rate limiting and audit logging
 */
export const loginUser = createAsyncThunk(
    'auth/login',
    async (credentials: LoginCredentials, { rejectWithValue }) => {
        try {
            // Authenticate user with rate limiting
            const { user, tokens } = await authService.authenticateUser(credentials);

            // Validate token integrity
            if (!authService.validateTokenIntegrity(tokens)) {
                throw new Error('Token integrity validation failed');
            }

            // Store tokens securely
            await secureStorage.setItem('auth_tokens', tokens, {
                expires: tokens.expiresIn,
                encrypt: true
            });

            // Log successful authentication
            await authService.logAuthEvent({
                type: 'LOGIN_SUCCESS',
                userId: user.id,
                orgId: user.orgId
            });

            return {
                user,
                tokens,
                organization: {
                    id: user.orgId,
                    name: user.organization.name,
                    settings: user.organization.settings
                }
            };
        } catch (error) {
            // Log authentication failure
            await authService.logAuthEvent({
                type: 'LOGIN_FAILURE',
                error: error.message
            });

            return rejectWithValue({
                message: error.message,
                code: error.code || 'AUTH_ERROR'
            });
        }
    }
);

/**
 * Enhanced async thunk for secure token refresh with integrity validation
 */
export const refreshToken = createAsyncThunk(
    'auth/refresh',
    async (_, { getState, rejectWithValue }) => {
        try {
            const tokens = await authService.refreshAuthToken();

            // Validate new token integrity
            if (!authService.validateTokenIntegrity(tokens)) {
                throw new Error('Refreshed token integrity validation failed');
            }

            // Update secure storage
            await secureStorage.setItem('auth_tokens', tokens, {
                expires: tokens.expiresIn,
                encrypt: true
            });

            // Log token refresh
            await authService.logAuthEvent({
                type: 'TOKEN_REFRESH_SUCCESS'
            });

            return tokens;
        } catch (error) {
            // Log refresh failure
            await authService.logAuthEvent({
                type: 'TOKEN_REFRESH_FAILURE',
                error: error.message
            });

            return rejectWithValue({
                message: error.message,
                code: 'REFRESH_ERROR'
            });
        }
    }
);

/**
 * Enhanced auth slice with comprehensive security features
 */
const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout: (state) => {
            // Secure logout with token cleanup
            secureStorage.removeItem('auth_tokens');
            authService.logoutUser();
            return { ...initialState };
        },
        setSessionTimeout: (state, action: PayloadAction<number>) => {
            state.sessionTimeout = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
        updateOrganizationContext: (state, action: PayloadAction<OrganizationContext>) => {
            state.organization = action.payload;
        }
    },
    extraReducers: (builder) => {
        // Login action handlers
        builder.addCase(loginUser.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        });
        builder.addCase(loginUser.fulfilled, (state, action) => {
            state.isLoading = false;
            state.isAuthenticated = true;
            state.user = action.payload.user;
            state.tokens = action.payload.tokens;
            state.organization = action.payload.organization;
            state.error = null;
        });
        builder.addCase(loginUser.rejected, (state, action) => {
            state.isLoading = false;
            state.isAuthenticated = false;
            state.error = action.payload as AuthError;
        });

        // Token refresh handlers
        builder.addCase(refreshToken.pending, (state) => {
            state.isLoading = true;
        });
        builder.addCase(refreshToken.fulfilled, (state, action) => {
            state.isLoading = false;
            state.tokens = action.payload;
        });
        builder.addCase(refreshToken.rejected, (state, action) => {
            // Clear auth state on refresh failure
            return { ...initialState };
        });
    }
});

// Export actions and reducer
export const {
    logout,
    setSessionTimeout,
    clearError,
    updateOrganizationContext
} = authSlice.actions;

export default authSlice.reducer;

// Memoized selector for auth state
export const selectAuth = (state: { auth: AuthState }) => state.auth;