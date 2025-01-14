/**
 * Core application constants defining layout measurements, UI configurations,
 * validation rules and other shared constants used across the frontend application.
 * Implements design system specifications and ensures accessibility compliance.
 */

/**
 * Interface defining layout-related constants for consistent component sizing and spacing
 */
export interface LayoutConstants {
  SPACING_UNIT: number;
  BREAKPOINTS: {
    MOBILE: number;
    TABLET: number;
    DESKTOP: number;
    LARGE_DESKTOP: number;
  };
  CONTAINER_WIDTHS: {
    MOBILE: string;
    TABLET: string;
    DESKTOP: string;
    LARGE_DESKTOP: string;
  };
  SIDEBAR_WIDTH: number;
  HEADER_HEIGHT: number;
  FOOTER_HEIGHT: number;
}

/**
 * Interface defining UI-related constants for consistent component behavior and accessibility
 */
export interface UIConstants {
  ANIMATION_DURATION: {
    SHORT: number;
    MEDIUM: number;
    LONG: number;
  };
  Z_INDEX: {
    MODAL: number;
    DROPDOWN: number;
    HEADER: number;
    SIDEBAR: number;
    OVERLAY: number;
    TOOLTIP: number;
  };
  MIN_TOUCH_TARGET: number;
  BORDER_RADIUS: {
    SMALL: number;
    MEDIUM: number;
    LARGE: number;
  };
}

/**
 * Interface defining validation-related constants for secure data handling
 */
export interface ValidationConstants {
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string[];
  MAX_UPLOAD_FILES: number;
  MIN_PASSWORD_LENGTH: number;
  MAX_PASSWORD_LENGTH: number;
  MAX_USERNAME_LENGTH: number;
  MAX_CHAT_MESSAGE_LENGTH: number;
}

/**
 * Interface defining date format patterns for consistent date handling
 */
export interface DateFormatConstants {
  DEFAULT: string;
  WITH_TIME: string;
  DISPLAY: string;
  DISPLAY_WITH_TIME: string;
}

/**
 * Layout constants for consistent component sizing and responsive behavior
 * Based on the design system specifications and responsive breakpoints
 */
export const LAYOUT_CONSTANTS: LayoutConstants = {
  SPACING_UNIT: 8,
  BREAKPOINTS: {
    MOBILE: 320,
    TABLET: 768,
    DESKTOP: 1024,
    LARGE_DESKTOP: 1440,
  },
  CONTAINER_WIDTHS: {
    MOBILE: '100%',
    TABLET: '750px',
    DESKTOP: '970px',
    LARGE_DESKTOP: '1170px',
  },
  SIDEBAR_WIDTH: 280,
  HEADER_HEIGHT: 64,
  FOOTER_HEIGHT: 48,
} as const;

/**
 * UI constants for consistent animations, layering, and accessibility compliance
 * Ensures WCAG 2.1 Level AA compliance for touch targets and interactions
 */
export const UI_CONSTANTS: UIConstants = {
  ANIMATION_DURATION: {
    SHORT: 200,
    MEDIUM: 300,
    LONG: 500,
  },
  Z_INDEX: {
    MODAL: 1000,
    DROPDOWN: 900,
    HEADER: 800,
    SIDEBAR: 700,
    OVERLAY: 600,
    TOOLTIP: 500,
  },
  MIN_TOUCH_TARGET: 44, // Minimum size in pixels for touch targets (WCAG 2.1)
  BORDER_RADIUS: {
    SMALL: 4,
    MEDIUM: 8,
    LARGE: 12,
  },
} as const;

/**
 * Validation constants for secure data handling and input validation
 * Implements security best practices for file uploads and user input
 */
export const VALIDATION_CONSTANTS: ValidationConstants = {
  MAX_FILE_SIZE: 10485760, // 10MB in bytes
  ALLOWED_FILE_TYPES: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
  MAX_UPLOAD_FILES: 10,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MAX_USERNAME_LENGTH: 50,
  MAX_CHAT_MESSAGE_LENGTH: 1000,
} as const;

/**
 * Date format constants for consistent date handling and display
 * Uses ISO 8601 format for default dates and user-friendly formats for display
 */
export const DATE_FORMAT_CONSTANTS: DateFormatConstants = {
  DEFAULT: 'YYYY-MM-DD',
  WITH_TIME: 'YYYY-MM-DD HH:mm:ss',
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm',
} as const;