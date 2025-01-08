/**
 * Barrel file for reusable table components
 * Implements WCAG 2.1 AA compliance and design system specifications
 * @version 1.0.0
 */

// Import table components and their prop types
import DataTable, { DataTableProps, Column } from './DataTable';
import TablePagination, { TablePaginationProps } from './TablePagination';

// Re-export components and types
export {
  DataTable,
  TablePagination,
  // Type definitions
  type DataTableProps,
  type TablePaginationProps,
  type Column,
};

// Default export for convenient imports
export default {
  DataTable,
  TablePagination,
};