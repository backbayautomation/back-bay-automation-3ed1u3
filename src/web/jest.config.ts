import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Specify jsdom test environment for DOM manipulation
  testEnvironment: 'jsdom',

  // Configure setup files that run before each test
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Configure test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}'
  ],

  // Module name mapping for path aliases and file mocks
  moduleNameMapper: {
    // Path alias mapping for src directory
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
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
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
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
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