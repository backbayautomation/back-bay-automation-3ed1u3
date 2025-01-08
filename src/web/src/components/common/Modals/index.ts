/**
 * @fileoverview Barrel export file for Modal components providing centralized access
 * to all modal-related components, interfaces, and types used in the application's common UI layer.
 * Implements Material-UI v5 base design system components with proper TypeScript type definitions.
 * 
 * @version 1.0.0
 * @module components/common/Modals
 */

// Base Modal component and types
export { default as Modal } from './Modal';
export type { ModalProps } from './Modal';

// Confirmation Modal component and types
export { default as ConfirmModal } from './ConfirmModal';
export type { ConfirmModalProps } from './ConfirmModal';

/**
 * @deprecated Use Modal or ConfirmModal components directly
 * @see Modal
 * @see ConfirmModal
 */
export * as ModalComponents from './Modal';