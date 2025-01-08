/**
 * Centralized barrel file for admin portal settings components.
 * Implements Material-UI v5 design system specifications and maintains WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

// Import settings components with their respective props interfaces
import ApiSettings from './ApiSettings';
import BrandingSettings, { BrandingSettingsProps } from './BrandingSettings';
import SecuritySettings, { SecuritySettingsProps } from './SecuritySettings';

// Export settings components and their props interfaces
export {
    // API Settings component for managing API configuration
    ApiSettings,
    
    // Branding Settings component and props for portal customization
    BrandingSettings,
    BrandingSettingsProps,
    
    // Security Settings component and props for access control configuration
    SecuritySettings,
    SecuritySettingsProps,
};

// Default export for convenient importing
export default {
    ApiSettings,
    BrandingSettings,
    SecuritySettings,
};