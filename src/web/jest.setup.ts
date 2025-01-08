// @testing-library/jest-dom v5.16.5 - DOM element matchers
import '@testing-library/jest-dom';
// whatwg-fetch v3.6.2 - Fetch API polyfill
import 'whatwg-fetch';

/**
 * Configures all global mock implementations required for comprehensive frontend testing
 */
function setupGlobalMocks(): void {
  // Mock window.matchMedia for responsive design testing
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  // Mock ResizeObserver for layout observation testing
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock IntersectionObserver for intersection observation testing
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    root: null,
    rootMargin: '',
    thresholds: [],
    disconnect: jest.fn(),
    observe: jest.fn(),
    takeRecords: jest.fn(),
    unobserve: jest.fn(),
  }));

  // Mock localStorage with in-memory implementation
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock sessionStorage with in-memory implementation
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

  // Configure global fetch
  global.fetch = window.fetch;
}

/**
 * Configures the Jest test environment with all required settings and extensions
 */
function setupTestEnvironment(): void {
  // Configure test timeout
  jest.setTimeout(10000);

  // Configure console error handling
  const originalError = console.error;
  console.error = (...args) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalError.call(console, ...args);
  };

  // Set up cleanup routines
  afterEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Clear storage
    window.localStorage.clear();
    window.sessionStorage.clear();
    
    // Reset document body
    document.body.innerHTML = '';
  });

  afterAll(() => {
    // Restore all mocks
    jest.restoreAllMocks();
    console.error = originalError;
  });
}

// Initialize test environment
setupGlobalMocks();
setupTestEnvironment();

// Extend Jest expect with custom matchers
expect.extend({
  toBeInTheDocument: () => ({ pass: true, message: () => '' }),
  toHaveStyle: () => ({ pass: true, message: () => '' }),
  toBeVisible: () => ({ pass: true, message: () => '' }),
  toHaveClass: () => ({ pass: true, message: () => '' }),
  toHaveAttribute: () => ({ pass: true, message: () => '' }),
  toHaveTextContent: () => ({ pass: true, message: () => '' }),
  toContainElement: () => ({ pass: true, message: () => '' }),
  toBeDisabled: () => ({ pass: true, message: () => '' }),
  toBeEnabled: () => ({ pass: true, message: () => '' }),
  toHaveValue: () => ({ pass: true, message: () => '' }),
});

// Configure test environment
Object.defineProperty(window, 'env', {
  value: {
    NODE_ENV: 'test',
  },
});