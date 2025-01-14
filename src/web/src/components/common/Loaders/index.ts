// @mui/material@5.14.0
import ContentLoader from './ContentLoader';
import PageLoader from './PageLoader';

// Export type definitions for ContentLoader with accessibility properties
export interface ContentLoaderProps {
  /** Width of the loading placeholder, supports responsive values */
  width?: string | number;
  /** Height of the loading placeholder, supports responsive values */
  height?: string | number;
  /** Shape variant of the loading placeholder following Material-UI design system */
  variant?: 'text' | 'rectangular' | 'circular';
  /** Animation style of the loading placeholder with reduced motion support */
  animation?: 'pulse' | 'wave' | 'none';
  /** Optional CSS class name for custom styling */
  className?: string;
  /** ARIA role for accessibility, defaults to 'progressbar' */
  role?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
}

// Export type definitions for PageLoader with accessibility properties
export interface PageLoaderProps {
  /** Optional loading message with proper contrast ratio */
  message?: string;
  /** Size of the loading indicator following Material-UI scale */
  size?: 'small' | 'medium' | 'large';
  /** ARIA role for accessibility, defaults to 'progressbar' */
  role?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Optional CSS class name for custom styling */
  className?: string;
}

// Export WCAG 2.1 AA compliant loading components with Material-UI v5 theming
export {
  ContentLoader,
  PageLoader
};