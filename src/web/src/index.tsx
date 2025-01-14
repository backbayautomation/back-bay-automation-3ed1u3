import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App';
import { store, persistor } from './redux/store';
import { lightTheme } from './config/theme';

/**
 * Error fallback component for global error handling
 */
const ErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" style={{
    padding: '20px',
    margin: '20px',
    border: '1px solid #ff0000',
    borderRadius: '4px',
    backgroundColor: '#fff5f5'
  }}>
    <h2>Application Error</h2>
    <pre style={{ color: '#ff0000' }}>{error.message}</pre>
    <button 
      onClick={() => window.location.reload()}
      style={{
        padding: '8px 16px',
        backgroundColor: '#0066CC',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Refresh Application
    </button>
  </div>
);

/**
 * Root element validation with type assertion
 */
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element. Please check your HTML file.');
}

/**
 * Create root using React 18 createRoot API
 */
const root = createRoot(rootElement);

/**
 * Render application with all required providers and strict mode
 */
root.render(
  <StrictMode>
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error('Global error:', error);
        // Here you could add error reporting service integration
      }}
    >
      <Provider store={store}>
        <PersistGate 
          loading={<div>Loading...</div>} 
          persistor={persistor}
        >
          <ThemeProvider theme={lightTheme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);

/**
 * Enable hot module replacement for development
 */
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    console.log('Hot reloading App component...');
    root.render(
      <StrictMode>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Provider store={store}>
            <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
              <ThemeProvider theme={lightTheme}>
                <CssBaseline />
                <App />
              </ThemeProvider>
            </PersistGate>
          </Provider>
        </ErrorBoundary>
      </StrictMode>
    );
  });
}

// Expose store for debugging in development
if (process.env.NODE_ENV === 'development') {
  (window as any).store = store;
}