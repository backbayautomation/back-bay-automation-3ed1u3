/**
 * Centralized barrel file for admin portal settings components.
 * Implements Material-UI v5 design system specifications and maintains WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

// Import settings components with their respective props interfaces
import ApiSettings from './ApiSettings';
import BrandingSettings, { BrandingSettingsProps } from './BrandingSettings';
import SecuritySettings, { SecuritySettingsProps } from './SecuritySettings';

// Export individual components and their props interfaces
export { 
    ApiSettings,
    BrandingSettings,
    SecuritySettings,
    // Export prop interfaces for external consumption
    type BrandingSettingsProps,
    type SecuritySettingsProps
};

// Default export for convenient importing
export default {
    ApiSettings,
    BrandingSettings,
    SecuritySettings
};

/**
 * Component Documentation:
 * 
 * ApiSettings: API configuration management component for admin portal
 * - Handles API key management
 * - Rate limiting configuration
 * - CORS and security settings
 * 
 * BrandingSettings: Portal customization component with props interface
 * - Company branding configuration
 * - Theme customization
 * - Logo and color management
 * 
 * SecuritySettings: Security configuration component with props interface
 * - Authentication settings
 * - Password policies
 * - Compliance controls
 */