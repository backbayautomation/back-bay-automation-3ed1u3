/**
 * Enhanced Redux store configuration with secure persistence, type-safe state management,
 * and optimized performance configurations.
 * @version 1.0.0
 */

import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'; // v1.9.5
import { persistStore, persistReducer, createTransform } from 'redux-persist'; // v6.0.0
import storage from 'redux-persist/lib/storage'; // v6.0.0
import encryptTransform from 'redux-persist-transform-encrypt'; // v3.0.0

// Import reducers
import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import documentReducer from './slices/documentSlice';
import uiReducer from './slices/uiSlice';

// Configure encryption transform for secure persistence
const encryptConfig = {
  secretKey: process.env.REACT_APP_PERSIST_KEY || crypto.randomUUID(),
  onError: (error: Error) => {
    console.error('Persistence encryption error:', error);
    // Clear persisted state on encryption error
    storage.removeItem('persist:root');
  }
};

// Create secure transform for state encryption
const secureTransform = encryptTransform(encryptConfig);

// Configure persistence with security options
const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['auth'], // Only persist authentication state
  blacklist: ['chat', 'document', 'ui'], // Don't persist these states
  transforms: [secureTransform],
  timeout: 10000, // 10 second timeout
  debug: process.env.NODE_ENV === 'development',
  migrate: (state: any, version: number) => {
    // Handle state migrations
    if (version === 0) {
      // Migration logic for version 0 to 1
      return {
        ...state,
        // Add migration transformations here
      };
    }
    return state;
  }
};

// Create listener middleware for side effects
const listenerMiddleware = createListenerMiddleware();

// Configure root reducer with persistence
const rootReducer = {
  auth: persistReducer(persistConfig, authReducer),
  chat: chatReducer,
  document: documentReducer,
  ui: uiReducer
};

/**
 * Configure and create Redux store with enhanced security and performance
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types in serialization checks
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore these paths in serialization checks
        ignoredPaths: ['ui.notifications']
      },
      // Enable immutability checks in development
      immutableCheck: process.env.NODE_ENV === 'development',
      // Enable thunk middleware
      thunk: true
    }).prepend(listenerMiddleware.middleware),
  devTools: process.env.NODE_ENV === 'development' && {
    // Configure Redux DevTools with security options
    maxAge: 50, // Limit stored actions
    trace: true,
    traceLimit: 25,
    actionsBlacklist: ['SOME_SENSITIVE_ACTION']
  }
});

// Create persistor
export const persistor = persistStore(store, null, () => {
  // After rehydration callback
  console.debug('Store rehydration complete');
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Add hot module replacement for reducers in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./slices/authSlice', () => {
    store.replaceReducer(persistReducer(persistConfig, authReducer));
  });
  module.hot.accept('./slices/chatSlice', () => {
    store.replaceReducer(chatReducer);
  });
  module.hot.accept('./slices/documentSlice', () => {
    store.replaceReducer(documentReducer);
  });
  module.hot.accept('./slices/uiSlice', () => {
    store.replaceReducer(uiReducer);
  });
}