/**
 * Enhanced Redux slice for secure authentication state management.
 * Implements OAuth 2.0 + OIDC with JWT tokens, multi-tenant support,
 * and comprehensive audit logging.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { SecureStorage } from '@secure-storage/browser'; // v1.2.0
import { 
    AuthState, 
    LoginCredentials, 
    AuthTokens, 
    UserProfile,
    OrganizationContext
} from '../../types/auth';
import { AuthService } from '../../services/auth';

// Initialize secure storage for tokens
const secureStorage = new SecureStorage({
    namespace: 'auth',
    storage: window.localStorage
});

// Initial state with multi-tenant support
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
            const { user, tokens, organization } = await AuthService.authenticateUser(credentials);

            // Validate token integrity
            if (!AuthService.validateTokenIntegrity(tokens)) {
                throw new Error('Token integrity validation failed');
            }

            // Store tokens securely
            await secureStorage.setItem('auth_tokens', tokens);

            // Log successful authentication
            AuthService.logAuthEvent('login_success', {
                userId: user.id,
                orgId: organization.id
            });

            return { user, tokens, organization };
        } catch (error) {
            // Log authentication failure
            AuthService.logAuthEvent('login_failure', {
                error: error.message,
                email: credentials.email
            });
            return rejectWithValue(error.message);
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
            const tokens = await AuthService.refreshAuthToken();

            // Validate refreshed token integrity
            if (!AuthService.validateTokenIntegrity(tokens)) {
                throw new Error('Refreshed token integrity validation failed');
            }

            // Update secure storage
            await secureStorage.setItem('auth_tokens', tokens);

            // Log token refresh
            AuthService.logAuthEvent('token_refresh_success', {
                tokenType: tokens.tokenType
            });

            return tokens;
        } catch (error) {
            // Log refresh failure
            AuthService.logAuthEvent('token_refresh_failure', {
                error: error.message
            });
            return rejectWithValue(error.message);
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
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        clearAuth: (state) => {
            state.isAuthenticated = false;
            state.user = null;
            state.tokens = null;
            state.error = null;
            state.organization = null;
            state.sessionTimeout = null;
            secureStorage.removeItem('auth_tokens');
        },
        setSessionTimeout: (state, action: PayloadAction<number>) => {
            state.sessionTimeout = action.payload;
        },
        updateOrganizationContext: (state, action: PayloadAction<OrganizationContext>) => {
            state.organization = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            // Login handling
            .addCase(loginUser.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
                state.tokens = action.payload.tokens;
                state.organization = action.payload.organization;
                state.error = null;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.error = action.payload as string;
            })
            // Token refresh handling
            .addCase(refreshToken.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(refreshToken.fulfilled, (state, action) => {
                state.isLoading = false;
                state.tokens = action.payload;
                state.error = null;
            })
            .addCase(refreshToken.rejected, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.tokens = null;
                state.error = action.payload as string;
            });
    }
});

// Export actions
export const { 
    setLoading, 
    clearAuth, 
    setSessionTimeout, 
    updateOrganizationContext 
} = authSlice.actions;

// Memoized selector for auth state
export const selectAuth = (state: { auth: AuthState }) => state.auth;

// Export reducer
export default authSlice.reducer;