/**
 * Barrel export file for common button components.
 * Implements Material-UI v5 base design system specifications.
 * Provides type-safe, accessible button components through named exports.
 * @packageDocumentation
 */

// Import button components and their props
import IconButton from './IconButton';
import type { IconButtonProps } from './IconButton';
import LoadingButton from './LoadingButton';
import type { LoadingButtonProps } from './LoadingButton';
import PrimaryButton from './PrimaryButton';
import type { PrimaryButtonProps } from './PrimaryButton';

// Re-export components and their props
export {
  IconButton,
  type IconButtonProps,
  LoadingButton,
  type LoadingButtonProps,
  PrimaryButton,
  type PrimaryButtonProps,
};