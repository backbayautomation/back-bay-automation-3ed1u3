/**
 * Centralized barrel file for admin portal settings components.
 * Implements Material-UI v5 design system specifications and maintains WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

// Import settings components with their respective props interfaces
import ApiSettings from './ApiSettings';
import BrandingSettings, { BrandingSettingsProps } from './BrandingSettings';
import SecuritySettings, { SecuritySettingsProps } from './SecuritySettings';

// Export individual components and their type definitions
export { ApiSettings };
export { BrandingSettings };
export { SecuritySettings };

// Export type definitions for component props
export type { BrandingSettingsProps };
export type { SecuritySettingsProps };

// Default export for convenient importing
export default {
  ApiSettings,
  BrandingSettings,
  SecuritySettings,
};