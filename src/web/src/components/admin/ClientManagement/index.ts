/**
 * Barrel file for client management components.
 * Provides centralized access to all client management related components
 * for the admin portal while maintaining type safety and efficient bundling.
 * @version 1.0.0
 */

// Core client management components with type definitions
export { default as ClientList } from './ClientList';
export { default as ClientForm } from './ClientForm';
export type { ClientFormProps } from './ClientForm';
export { default as ClientTable } from './ClientTable';
export type { ClientTableProps } from './ClientTable';