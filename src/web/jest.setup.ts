// @testing-library/jest-dom v5.16.5 - DOM element matchers
import '@testing-library/jest-dom';
// whatwg-fetch v3.6.2 - Fetch API polyfill
import 'whatwg-fetch';

/**
 * Configures all global mock implementations required for frontend testing
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

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

  // Set up global fetch
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
    
    // Restore console.error
    console.error = originalError;
  });
}

// Initialize test environment
setupGlobalMocks();
setupTestEnvironment();

// Extend expect with custom matchers
expect.extend({
  toHaveBeenCalledWithMatch(received: jest.Mock, ...expected: any[]) {
    const pass = received.mock.calls.some(call =>
      expected.every((arg, index) =>
        typeof arg === 'object'
          ? expect.objectContaining(arg).asymmetricMatch(call[index])
          : arg === call[index]
      )
    );

    return {
      pass,
      message: () =>
        `expected ${received.getMockName()} to have been called with arguments matching ${expected}`,
    };
  },
});

// Export types for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithMatch(...args: any[]): R;
    }
  }
}