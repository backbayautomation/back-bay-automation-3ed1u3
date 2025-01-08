/**
 * Barrel file for client management components.
 * Provides centralized access to all client management related components
 * for the admin portal with proper type exports.
 * @version 1.0.0
 */

// Export client list component with its dependencies
export { default as ClientList } from './ClientList';

// Export client form component with its type definitions
export { default as ClientForm } from './ClientForm';
export type { ClientFormProps } from './ClientForm';

// Export client table component with its type definitions
export { default as ClientTable } from './ClientTable';
export type { ClientTableProps } from './ClientTable';