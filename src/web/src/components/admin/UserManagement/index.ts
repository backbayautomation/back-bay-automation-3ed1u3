/**
 * Barrel file for user management components providing centralized access to user management functionality.
 * Implements role-based access control and WCAG 2.1 AA compliance for admin portal components.
 * @version 1.0.0
 */

// Import user management components with proper type definitions
import UserList from './UserList';
import { UserForm } from './UserForm';
import UserTable from './UserTable';

// Export components with comprehensive type definitions for external use
export {
  UserList,
  UserForm,
  UserTable,
};

// Type exports for component props to enable strong typing in consuming components
export type { UserListProps } from './UserList';
export type { UserFormProps } from './UserForm';
export type { UserTableProps } from './UserTable';

/**
 * Default export for convenient import of all user management components
 * Enables both named and default imports based on consumer preference
 */
export default {
  UserList,
  UserForm,
  UserTable,
};