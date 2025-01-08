/**
 * Barrel export file for layout components with comprehensive type definitions.
 * Provides consistent access to layout components for the dual-portal system.
 * @version 1.0.0
 */

// Import components and their types
import Header from './Header';
import type { HeaderProps } from './Header';

import Footer from './Footer';
import type { FooterProps } from './Footer';

import Sidebar from './Sidebar';
import type { SidebarProps } from './Sidebar';

import MainLayout from './MainLayout';
import type { MainLayoutProps } from './MainLayout';

// Re-export components with proper type definitions
export {
  Header,
  type HeaderProps,
  Footer,
  type FooterProps,
  Sidebar,
  type SidebarProps,
  MainLayout,
  type MainLayoutProps,
};

/**
 * Default export for convenient import of all layout components
 * @example
 * import Layout from './components/common/Layout';
 * const { Header, Footer, Sidebar, MainLayout } = Layout;
 */
export default {
  Header,
  Footer,
  Sidebar,
  MainLayout,
};

// Type definitions for layout-specific interfaces
export interface LayoutTheme {
  spacing: (value: number) => string;
  palette: {
    background: {
      default: string;
      paper: string;
    };
    text: {
      primary: string;
      secondary: string;
    };
    divider: string;
  };
  transitions: {
    create: (props: string[], options?: { duration?: number; easing?: string }) => string;
  };
  zIndex: {
    appBar: number;
    drawer: number;
  };
}

/**
 * Common layout configuration constants
 */
export const LAYOUT_CONSTANTS = {
  DRAWER_WIDTH: 240,
  HEADER_HEIGHT: 64,
  FOOTER_HEIGHT: 48,
  MOBILE_BREAKPOINT: 768,
  TRANSITION_DURATION: 225,
} as const;

/**
 * Portal type definition for dual-portal system
 */
export type PortalType = 'admin' | 'client';

/**
 * Layout state interface for managing responsive behavior
 */
export interface LayoutState {
  isSidebarOpen: boolean;
  isMobile: boolean;
  portalType: PortalType;
}