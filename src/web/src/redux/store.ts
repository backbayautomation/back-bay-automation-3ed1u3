/**
 * Redux store configuration with enhanced security, type safety, and performance optimizations.
 * Implements secure state persistence, middleware integration, and development tools.
 * @version 1.0.0
 */

import { 
    configureStore, 
    createListenerMiddleware,
    TypedStartListening,
    TypedAddListener
} from '@reduxjs/toolkit'; // v1.9.5
import { 
    persistStore, 
    persistReducer,
    createTransform,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER
} from 'redux-persist'; // v6.0.0
import storage from 'redux-persist/lib/storage'; // v6.0.0
import encryptTransform from 'redux-persist-transform-encrypt'; // v3.0.0

// Import reducers
import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import documentReducer from './slices/documentSlice';
import uiReducer from './slices/uiSlice';

// Configure encryption transform for sensitive data
const encryptConfig = {
    secretKey: process.env.REACT_APP_PERSIST_KEY || 'default-key-do-not-use-in-production',
    onError: (error: Error) => {
        console.error('Encryption Error:', error);
        // Clear persisted state on encryption error
        storage.removeItem('persist:root');
    }
};

// Configure persistence with encryption
const persistConfig = {
    key: 'root',
    version: 1,
    storage,
    whitelist: ['auth'], // Only persist authentication state
    blacklist: ['chat', 'document', 'ui'], // Don't persist these states
    transforms: [
        encryptTransform(encryptConfig)
    ],
    timeout: 10000, // 10 second timeout
    debug: process.env.NODE_ENV === 'development'
};

// Create listener middleware for side effects
const listenerMiddleware = createListenerMiddleware({
    onError: (error, { raisedBy }) => {
        console.error(`Listener middleware error in ${raisedBy}:`, error);
    }
});

// Configure root reducer with persistence
const rootReducer = {
    auth: persistReducer(persistConfig, authReducer),
    chat: chatReducer,
    document: documentReducer,
    ui: uiReducer
};

// Configure and create store with middleware
export const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => 
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [
                    FLUSH, REHYDRATE, PAUSE, 
                    PERSIST, PURGE, REGISTER
                ]
            },
            thunk: {
                extraArgument: undefined
            }
        }).prepend(listenerMiddleware.middleware),
    devTools: process.env.NODE_ENV === 'development' && {
        name: 'AI Catalog Search',
        maxAge: 50,
        trace: true,
        traceLimit: 25,
        serialize: {
            options: {
                undefined: true,
                function: false
            }
        }
    }
});

// Create persistor
export const persistor = persistStore(store, null, () => {
    console.debug('Redux state rehydration complete');
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStartListening = TypedStartListening<RootState, AppDispatch>;
export type AppAddListener = TypedAddListener<RootState, AppDispatch>;

// Export listener middleware
export const startAppListening = listenerMiddleware.startListening as AppStartListening;
export const addAppListener = listenerMiddleware.addListener as AppAddListener;

// Handle hot module replacement for reducers
if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept('./slices/authSlice', () => {
        store.replaceReducer(persistReducer(persistConfig, authReducer));
    });
}