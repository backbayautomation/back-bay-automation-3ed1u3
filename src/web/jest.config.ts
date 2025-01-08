import type { Config } from '@jest/types';

/**
 * Comprehensive Jest configuration for React frontend application testing
 * Configured for high test coverage, efficient execution, and comprehensive testing capabilities
 * @version Jest 29.6.3
 */
const config: Config.InitialOptions = {
  // Use jsdom environment for DOM manipulation testing
  testEnvironment: 'jsdom',

  // Configure test setup file containing global mocks and custom matchers
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}'
  ],

  // Module path mappings for clean imports
  moduleNameMapper: {
    // Alias for src directory imports
    '^@/(.*)$': '<rootDir>/src/$1',
    
    // Style file mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Asset file mocks
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '\\.(woff|woff2|eot|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js',
    
    // Web worker mocks
    '\\.worker\\.ts$': '<rootDir>/__mocks__/workerMock.js'
  },

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json'
      }
    ]
  },

  // Code coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  
  // Coverage thresholds enforcing >85% coverage requirement
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Paths to exclude from coverage reporting
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/dist/',
    '/__mocks__/',
    '/src/types/',
    '/src/constants/'
  ],

  // Test execution configuration
  testTimeout: 10000,
  verbose: true,
  
  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  // TypeScript configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: true
    }
  },

  // Performance optimization
  maxWorkers: '50%',

  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
};

export default config;