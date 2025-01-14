/**
 * Barrel file exporting reusable table components with WCAG 2.1 AA compliance
 * and design system specifications for consistent table implementations.
 * @version 1.0.0
 */

// Import table components and their prop types
import DataTable, { DataTableProps, Column } from './DataTable';
import TablePagination, { TablePaginationProps } from './TablePagination';

// Re-export components and types for external use
export {
    DataTable,
    TablePagination,
    // Type exports
    type DataTableProps,
    type TablePaginationProps,
    type Column,
};

// Default export for convenient imports
export default {
    DataTable,
    TablePagination,
};