import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux'; // v8.1.1
import { PersistGate } from 'redux-persist/integration/react'; // v6.0.0
import { ThemeProvider, createTheme } from '@mui/material/styles'; // v5.14.0
import { CssBaseline } from '@mui/material'; // v5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import App from './App';
import { store, persistor } from './redux/store';

// Create theme instance with enterprise design system
const theme = createTheme({
  // Theme configuration will be handled by ThemeContext
  // This is just a base theme that will be overridden
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Ensure proper touch targets for mobile
        'button, [role="button"]': {
          minHeight: '44px',
          minWidth: '44px',
        },
        // Improve text rendering
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
        },
        // Prevent content shift during loading
        '#root': {
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        },
      },
    },
  },
});

// Error fallback component for global error boundary
const ErrorFallback = ({ error }: { error: Error }) => (
  <div
    role="alert"
    style={{
      padding: '20px',
      margin: '20px',
      border: '1px solid #ff0000',
      borderRadius: '4px',
      backgroundColor: '#fff5f5',
    }}
  >
    <h2>Application Error</h2>
    <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
    <button
      onClick={() => window.location.reload()}
      style={{
        padding: '8px 16px',
        marginTop: '16px',
        backgroundColor: '#0066CC',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      Reload Application
    </button>
  </div>
);

// Get root element with type safety
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Create root using React 18 createRoot API
const root = createRoot(rootElement);

// Render application with all required providers
root.render(
  <StrictMode>
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        // Log error to monitoring service
        console.error('Application Error:', error);
      }}
    >
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    // Re-render app when App component updates
    root.render(
      <StrictMode>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <ThemeProvider theme={theme}>
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