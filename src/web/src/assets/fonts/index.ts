/**
 * @fileoverview Typography system configuration and font asset management
 * Implements design system typography requirements with accessibility compliance
 * and cross-browser compatibility
 * @version 1.0.0
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
 * Follows WCAG guidelines for readability and accessibility
 */
export const fontFamilies = {
  primary: "Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, sans-serif",
  secondary: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, sans-serif",
  code: "'Fira Mono', 'Courier New', Courier, monospace",
} as const;

/**
 * Type definitions for font weights to ensure type safety
 */
export type FontWeight = typeof fontWeights[keyof typeof fontWeights];

/**
 * Type definitions for font families to ensure type safety
 */
export type FontFamily = typeof fontFamilies[keyof typeof fontFamilies];

/**
 * Font scaling configuration following design system specifications
 * Ensures consistent typography scaling across different screen sizes
 */
export const fontSizes = {
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '20px',
  xl: '24px',
  xxl: '32px',
} as const;

/**
 * Type definitions for font sizes to ensure type safety
 */
export type FontSize = typeof fontSizes[keyof typeof fontSizes];

/**
 * Font configuration object for easy consumption by style sheets
 * Referenced by variables.scss and theme.scss
 */
export const typography = {
  weights: fontWeights,
  families: fontFamilies,
  sizes: fontSizes,
} as const;

// Default export for convenient import of all typography settings
export default typography;