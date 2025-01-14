/**
 * Barrel export file for layout components used in the dual-portal system.
 * Provides centralized access to all layout components with proper type definitions.
 * Implements standardized component exports following the design system specifications.
 * @version 1.0.0
 */

// Import layout components and their types
import Header from './Header';
import type { HeaderProps } from './Header';

import Footer from './Footer';
import type { FooterProps } from './Footer';

import Sidebar from './Sidebar';
import type { NavigationItem } from './Sidebar';

import MainLayout from './MainLayout';
import type { MainLayoutProps } from './MainLayout';

// Re-export components and types
export {
  // Components
  Header,
  Footer,
  Sidebar,
  MainLayout,
  
  // Types
  type HeaderProps,
  type FooterProps,
  type NavigationItem,
  type MainLayoutProps
};

// Default export for convenient imports
export default {
  Header,
  Footer,
  Sidebar,
  MainLayout
};