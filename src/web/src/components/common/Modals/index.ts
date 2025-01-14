/**
 * @fileoverview Barrel export file for Modal components providing centralized access to all
 * modal-related components, interfaces, and types used in the application's common UI layer.
 * Implements Material-UI v5 base design system components with proper TypeScript type definitions.
 * 
 * @packageDocumentation
 */

// Base Modal component and types
export { default as Modal } from './Modal';
export type { ModalProps } from './Modal';

// Confirmation Modal component and types
export { default as ConfirmModal } from './ConfirmModal';
export type { ConfirmModalProps } from './ConfirmModal';

/**
 * @deprecated Use Modal or ConfirmModal components directly
 * This namespace is kept for backward compatibility and will be removed in future versions
 */
export const Modals = {
  Modal,
  ConfirmModal,
} as const;