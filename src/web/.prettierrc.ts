// @prettier/plugin-typescript ^3.0.0 - Core code formatting library with TypeScript and React support

/**
 * Prettier Configuration
 * Optimized for TypeScript 5.0+ and React components in enterprise applications
 * 
 * This configuration enforces consistent code formatting standards across the codebase
 * while maintaining high readability and maintainability standards.
 */

import type { Config } from 'prettier';

const prettierConfig: Config = {
  // Maximum line length before wrapping
  printWidth: 100,

  // Indentation level - 2 spaces for optimal readability
  tabWidth: 2,

  // Use spaces instead of tabs for consistent rendering
  useTabs: false,

  // Always use semicolons for clear statement termination
  semi: true,

  // Use single quotes for string literals
  singleQuote: true,

  // Use ES5 trailing comma style for cleaner git diffs
  trailingComma: 'es5',

  // Add spaces between brackets in object literals
  bracketSpacing: true,

  // Omit parentheses around single arrow function parameters
  arrowParens: 'avoid',

  // Use LF for consistent line endings across platforms
  endOfLine: 'lf',

  // Use double quotes in JSX for HTML compatibility
  jsxSingleQuote: false,

  // Place closing angle bracket on new line for JSX elements
  jsxBracketSameLine: false,

  // Use TypeScript parser for accurate parsing
  parser: 'typescript',
};

export default prettierConfig;