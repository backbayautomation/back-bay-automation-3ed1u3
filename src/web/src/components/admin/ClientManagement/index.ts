/**
 * Barrel file for client management components providing centralized access
 * to all client management related functionality in the admin portal.
 * Implements type-safe exports for client list, form, and table components.
 * @version 1.0.0
 */

// Internal component imports with type safety
import ClientList from './ClientList';
import ClientForm, { ClientFormProps } from './ClientForm';
import ClientTable, { ClientTableProps } from './ClientTable';

// Export client management components and their types
export {
    // Main client list component
    ClientList,
    
    // Client form component and its props interface
    ClientForm,
    type ClientFormProps,
    
    // Client table component and its props interface
    ClientTable,
    type ClientTableProps
};

// Default export for convenient importing
export default ClientList;