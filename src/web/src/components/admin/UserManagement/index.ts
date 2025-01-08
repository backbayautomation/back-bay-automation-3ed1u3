/**
 * Barrel file exporting user management components for the admin portal.
 * Provides centralized access to user management functionality with role-based access control
 * and WCAG 2.1 AA compliance support.
 * @version 1.0.0
 */

// Import user management components
import UserList from './UserList';
import { UserForm } from './UserForm';
import UserTable from './UserTable';

// Re-export components with proper typing
export {
  UserList,
  UserForm,
  UserTable
};

// Export component types for external usage
export type { UserListProps } from './UserList';
export type { UserFormProps } from './UserForm';
export type { UserTableProps } from './UserTable';