/**
 * Redux store configuration with enhanced security, type-safe state management,
 * and optimized performance settings for the AI-powered Product Catalog Search System.
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

// Configure encryption for persisted state
const encryptConfig = {
  secretKey: process.env.REACT_APP_PERSIST_KEY || 'default-secure-key',
  onError: (error: Error) => {
    console.error('Persistence encryption error:', error);
    // Clear potentially corrupted state
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
  debug: process.env.NODE_ENV === 'development',
  migrate: (state: any, version: number) => {
    if (version === 0) {
      // Handle migration from version 0 to 1 if needed
      return Promise.resolve(state);
    }
    return Promise.resolve(state);
  }
};

// Create listener middleware for side effects
const listenerMiddleware = createListenerMiddleware();

// Configure and create store with security and performance optimizations
const setupStore = () => {
  // Create persisted reducer
  const persistedReducer = persistReducer(
    persistConfig,
    authReducer
  );

  // Configure store with optimized middleware
  const store = configureStore({
    reducer: {
      auth: persistedReducer,
      chat: chatReducer,
      document: documentReducer,
      ui: uiReducer
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types in serializability check
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
          // Ignore these field paths in serializability check
          ignoredPaths: ['payload.file', 'payload.error']
        },
        thunk: {
          extraArgument: undefined
        }
      }).prepend(listenerMiddleware.middleware),
    devTools: process.env.NODE_ENV === 'development' && {
      // Configure Redux DevTools with security options
      maxAge: 50, // Limit stored actions
      trace: true,
      traceLimit: 25,
      actionsBlacklist: ['SOME_SENSITIVE_ACTION']
    }
  });

  // Enable hot module replacement for reducers in development
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept('./slices/authSlice', () => {
      store.replaceReducer(persistedReducer);
    });
  }

  return store;
};

// Create store instance
export const store = setupStore();

// Create persistor
export const persistor = persistStore(store, null, () => {
  console.debug('Redux state rehydration complete');
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export store instance and types
export default store;