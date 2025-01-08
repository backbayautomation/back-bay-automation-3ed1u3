/**
 * Font Asset Management and Typography System Configuration
 * Version: 1.0.0
 * 
 * This module centralizes font management and typography configuration,
 * implementing the design system requirements while ensuring WCAG compliance
 * and cross-browser compatibility.
 */

// Font file paths with WOFF2 format for optimal loading performance
export const RobotoRegular = '/assets/fonts/Roboto-Regular.woff2';
export const RobotoMedium = '/assets/fonts/Roboto-Medium.woff2';
export const RobotoBold = '/assets/fonts/Roboto-Bold.woff2';
export const OpenSansRegular = '/assets/fonts/OpenSans-Regular.woff2';
export const OpenSansBold = '/assets/fonts/OpenSans-Bold.woff2';
export const FiraMono = '/assets/fonts/FiraMono-Regular.woff2';

/**
 * Standardized font weights following the W3C specifications
 * for consistent typography and accessibility compliance
 */
export const fontWeights = {
  normal: 400,
  medium: 500,
  bold: 700,
} as const;

/**
 * Font family definitions with comprehensive fallback chains
 * ensuring consistent rendering across different operating systems and browsers.
 * Fallbacks are ordered by similarity to maintain design integrity.
 */
export const fontFamilies = {
  primary: "Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, sans-serif",
  secondary: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, sans-serif",
  code: "'Fira Mono', 'Courier New', Courier, monospace",
} as const;

/**
 * Type definitions for font weights to ensure type safety
 * when consuming these values throughout the application
 */
export type FontWeight = typeof fontWeights[keyof typeof fontWeights];

/**
 * Type definitions for font families to ensure type safety
 * when consuming these values throughout the application
 */
export type FontFamily = typeof fontFamilies[keyof typeof fontFamilies];

/**
 * Font configuration interface for type-safe font management
 */
export interface FontConfig {
  family: FontFamily;
  weight: FontWeight;
  path: string;
}

/**
 * Mapping of font configurations for internal reference
 * This helps maintain consistency when applying fonts throughout the application
 */
export const fontConfigs: Record<string, FontConfig> = {
  robotoRegular: {
    family: fontFamilies.primary,
    weight: fontWeights.normal,
    path: RobotoRegular,
  },
  robotoMedium: {
    family: fontFamilies.primary,
    weight: fontWeights.medium,
    path: RobotoMedium,
  },
  robotoBold: {
    family: fontFamilies.primary,
    weight: fontWeights.bold,
    path: RobotoBold,
  },
  openSansRegular: {
    family: fontFamilies.secondary,
    weight: fontWeights.normal,
    path: OpenSansRegular,
  },
  openSansBold: {
    family: fontFamilies.secondary,
    weight: fontWeights.bold,
    path: OpenSansBold,
  },
  firaMono: {
    family: fontFamilies.code,
    weight: fontWeights.normal,
    path: FiraMono,
  },
} as const;

/**
 * Font scaling values following the design system specifications
 * These values ensure consistent typography scaling across the application
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
 * Line height values optimized for readability and WCAG compliance
 * Following WCAG 2.1 Success Criterion 1.4.12 Text Spacing
 */
export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

/**
 * Letter spacing values for enhanced readability
 * Particularly important for heading and display text
 */
export const letterSpacing = {
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
} as const;