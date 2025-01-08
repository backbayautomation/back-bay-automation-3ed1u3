/**
 * Typography System Configuration
 * Version: 1.0.0
 * 
 * Centralizes font assets and typography configuration for the application.
 * Implements design system typography requirements with:
 * - Roboto (Primary)
 * - Open Sans (Secondary)
 * - Fira Mono (Code)
 * 
 * Ensures WCAG AA compliance and cross-browser compatibility
 */

// Font file paths using WOFF2 format for optimal loading and browser support
export const RobotoRegular = '/assets/fonts/Roboto-Regular.woff2';
export const RobotoMedium = '/assets/fonts/Roboto-Medium.woff2';
export const RobotoBold = '/assets/fonts/Roboto-Bold.woff2';
export const OpenSansRegular = '/assets/fonts/OpenSans-Regular.woff2';
export const OpenSansBold = '/assets/fonts/OpenSans-Bold.woff2';
export const FiraMono = '/assets/fonts/FiraMono-Regular.woff2';

/**
 * Standardized font weights following Material Design guidelines
 * Ensures consistent typography across the application
 */
export const fontWeights = {
  normal: 400,
  medium: 500,
  bold: 700,
} as const;

/**
 * Font family definitions with comprehensive fallback chains
 * Ensures consistent rendering across different operating systems and browsers
 * Follows accessibility best practices for readability
 */
export const fontFamilies = {
  primary: "Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, sans-serif",
  secondary: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, sans-serif",
  code: "'Fira Mono', 'Courier New', Courier, monospace",
} as const;

// Type definitions for better TypeScript support
export type FontWeight = typeof fontWeights[keyof typeof fontWeights];
export type FontFamily = typeof fontFamilies[keyof typeof fontFamilies];

// Font path type definitions
export type FontPath = 
  | typeof RobotoRegular
  | typeof RobotoMedium
  | typeof RobotoBold
  | typeof OpenSansRegular
  | typeof OpenSansBold
  | typeof FiraMono;

/**
 * Constants used by SCSS variables and theming
 * @see src/web/src/styles/variables.scss
 * @see src/web/src/styles/theme.scss
 */
export const FONT_WEIGHTS = fontWeights;
export const FONT_FAMILIES = fontFamilies;