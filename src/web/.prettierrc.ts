// Prettier configuration v3.0.0
// Optimized for TypeScript 5.0+ and React enterprise applications

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