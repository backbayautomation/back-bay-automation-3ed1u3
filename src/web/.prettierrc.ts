// @prettier/version: ^3.0.0
// Comprehensive Prettier configuration for enterprise React TypeScript application
// Optimized for TypeScript 5.0+ and React components

import type { Config } from 'prettier';

const prettierConfig: Config = {
  // Maximum line length before wrapping
  printWidth: 100,

  // Indentation level - 2 spaces for optimal readability
  tabWidth: 2,

  // Use spaces instead of tabs for consistent rendering
  useTabs: false,

  // Always use semicolons for statement termination
  semi: true,

  // Use single quotes for string literals
  singleQuote: true,

  // ES5-compatible trailing commas for cleaner git diffs
  trailingComma: 'es5',

  // Add spaces between brackets in object literals
  bracketSpacing: true,

  // Omit parentheses around single arrow function parameters
  arrowParens: 'avoid',

  // Unix-style line endings for cross-platform consistency
  endOfLine: 'lf',

  // Use double quotes in JSX for HTML compatibility
  jsxSingleQuote: false,

  // Place closing angle bracket on new line for JSX elements
  jsxBracketSameLine: false,

  // Use TypeScript parser for accurate parsing
  parser: 'typescript',
};

export default prettierConfig;