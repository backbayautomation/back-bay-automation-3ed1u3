/**
 * Barrel export file for layout components implementing the dual-portal system.
 * Provides strongly-typed exports for all layout components with comprehensive documentation.
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

// Re-export components with comprehensive JSDoc documentation

/**
 * Header component for the dual-portal system.
 * Implements responsive navigation with user authentication and portal-specific controls.
 * @component
 */
export { Header };
export type { HeaderProps };

/**
 * Footer component with WCAG 2.1 AA compliance and theme integration.
 * Provides consistent layout termination across both admin and client portals.
 * @component
 */
export { Footer };
export type { FooterProps };

/**
 * Sidebar navigation component with role-based access control.
 * Supports nested navigation, keyboard accessibility, and responsive behavior.
 * @component
 */
export { Sidebar };
export type { SidebarProps };

/**
 * Main layout component orchestrating the overall application structure.
 * Manages responsive layout transitions and component composition for both portals.
 * @component
 */
export { MainLayout };
export type { MainLayoutProps };

// Default export for convenient importing
export default {
  Header,
  Footer,
  Sidebar,
  MainLayout,
};