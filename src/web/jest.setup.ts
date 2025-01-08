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

  // Mock IntersectionObserver
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    root: null,
    rootMargin: '',
    thresholds: [],
    disconnect: jest.fn(),
    observe: jest.fn(),
    takeRecords: jest.fn(),
    unobserve: jest.fn(),
  }));

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

  // Ensure fetch is available globally
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

  // Set up global mocks
  setupGlobalMocks();
}

// Initialize test environment
setupTestEnvironment();

// Configure cleanup hooks
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
});

// Extend expect with custom matchers
expect.extend({
  toHaveBeenCalledOnce(received: jest.Mock) {
    const pass = received.mock.calls.length === 1;
    return {
      pass,
      message: () =>
        pass
          ? `Expected function not to have been called once`
          : `Expected function to have been called once, but it was called ${received.mock.calls.length} times`,
    };
  },
});

// Declare global types for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledOnce(): R;
    }
  }
}