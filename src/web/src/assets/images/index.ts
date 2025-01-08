/**
 * Image Assets Index
 * Version: 1.0.0
 * 
 * Centralized management of all image assets used across the admin and client portals.
 * Supports theme variants, branding assets, and UI illustrations with proper type safety.
 */

// Base configuration for image assets
export const IMAGE_BASE_PATH = '/assets/images';
export const SUPPORTED_IMAGE_FORMATS = ['svg', 'png', 'webp'] as const;

/**
 * Interface for image assets that support multiple theme variants
 */
export interface ImageMetadata {
  light: string;
  dark: string;
  alt: string;
}

/**
 * Interface for empty state illustration variants
 */
export interface EmptyStateImages {
  noResults: string;
  noDocuments: string;
  error: string;
  noAccess: string;
}

/**
 * Application logo with theme variants
 */
export const appLogo: ImageMetadata = {
  light: `${IMAGE_BASE_PATH}/logo/app-logo-light.svg`,
  dark: `${IMAGE_BASE_PATH}/logo/app-logo-dark.svg`,
  alt: 'AI-Powered Product Catalog Search System'
};

/**
 * Theme-aware background images for authentication pages
 */
export const loginBackground: Omit<ImageMetadata, 'alt'> = {
  light: `${IMAGE_BASE_PATH}/backgrounds/login-bg-light.webp`,
  dark: `${IMAGE_BASE_PATH}/backgrounds/login-bg-dark.webp`
};

/**
 * Default user avatar placeholder with theme support
 */
export const defaultAvatar: ImageMetadata = {
  light: `${IMAGE_BASE_PATH}/avatars/default-avatar-light.svg`,
  dark: `${IMAGE_BASE_PATH}/avatars/default-avatar-dark.svg`,
  alt: 'Default User Avatar'
};

/**
 * Empty state and error illustrations
 */
export const emptyState: EmptyStateImages = {
  noResults: `${IMAGE_BASE_PATH}/empty-states/no-results.svg`,
  noDocuments: `${IMAGE_BASE_PATH}/empty-states/no-documents.svg`,
  error: `${IMAGE_BASE_PATH}/empty-states/error.svg`,
  noAccess: `${IMAGE_BASE_PATH}/empty-states/no-access.svg`
};

/**
 * Common UI icons used throughout the application
 */
export const icons: Record<string, string> = {
  search: `${IMAGE_BASE_PATH}/icons/search.svg`,
  upload: `${IMAGE_BASE_PATH}/icons/upload.svg`,
  settings: `${IMAGE_BASE_PATH}/icons/settings.svg`,
  help: `${IMAGE_BASE_PATH}/icons/help.svg`
} as const;

/**
 * Type guard to check if a given path is a supported image format
 */
export const isSupportedImageFormat = (path: string): boolean => {
  return SUPPORTED_IMAGE_FORMATS.some(format => path.toLowerCase().endsWith(`.${format}`));
};

/**
 * Helper function to get the full image path
 */
export const getImagePath = (relativePath: string): string => {
  if (!relativePath.startsWith('/')) {
    return `${IMAGE_BASE_PATH}/${relativePath}`;
  }
  return relativePath;
};