/**
 * Barrel export file for common loading components
 * Implements Material-UI v5 base design system's loading states with WCAG 2.1 AA compliance
 * @version 1.0.0
 */

// Import loading components
import ContentLoader from './ContentLoader';
import PageLoader from './PageLoader';

// Re-export component types from source files
export type { ContentLoaderProps } from './ContentLoader';
export type { PageLoaderProps } from './PageLoader';

// Named exports of loading components
export { ContentLoader, PageLoader };