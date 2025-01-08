import React, { StrictMode } from 'react'; // v18.2.0
import { createRoot } from 'react-dom/client'; // v18.2.0
import { Provider } from 'react-redux'; // v8.1.1
import { PersistGate } from 'redux-persist/integration/react'; // v6.0.0
import { ThemeProvider, createTheme } from '@mui/material/styles'; // v5.14.0
import CssBaseline from '@mui/material/CssBaseline'; // v5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

// Internal imports
import App from './App';
import { store, persistor } from './redux/store';

// Get root element with type safety check
const rootElement = document.getElementById('root') as HTMLElement;

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

// Create root using React 18 concurrent features
const root = createRoot(rootElement);

// Error fallback component
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
        backgroundColor: '#ff0000',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Reload Application
    </button>
  </div>
);

// Error handler for logging and monitoring
const handleError = (error: Error, info: { componentStack: string }) => {
  // TODO: Integrate with error reporting service
  console.error('Application Error:', error);
  console.error('Component Stack:', info.componentStack);
};

// Create base theme configuration
const baseTheme = createTheme({
  // Theme configuration would be imported from theme.ts
  // This is a fallback configuration
  palette: {
    mode: 'light',
    primary: {
      main: '#0066CC',
    },
    secondary: {
      main: '#4CAF50',
    },
  },
});

// Render application with all required providers
root.render(
  <StrictMode>
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => window.location.reload()}
    >
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider theme={baseTheme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);

// Enable hot module replacement for development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    console.log('Hot reloading App component...');
    root.render(
      <StrictMode>
        <ErrorBoundary 
          FallbackComponent={ErrorFallback}
          onError={handleError}
          onReset={() => window.location.reload()}
        >
          <Provider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <ThemeProvider theme={baseTheme}>
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

// Log application initialization
console.info('Application initialized in', process.env.NODE_ENV, 'mode');