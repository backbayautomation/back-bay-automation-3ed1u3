/**
 * Barrel file exporting user management components for the admin portal.
 * Provides centralized access to user management functionality with role-based
 * access control and WCAG 2.1 AA compliance.
 * @version 1.0.0
 */

// Import user management components
import UserList from './UserList';
import { UserForm } from './UserForm';
import UserTable from './UserTable';

// Export components for external use
export {
  UserList,
  UserForm,
  UserTable
};

// Export default for convenient single import
export default {
  UserList,
  UserForm,
  UserTable
};