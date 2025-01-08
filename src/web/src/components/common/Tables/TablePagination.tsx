import React, { useCallback, useMemo } from 'react';
import { Pagination, Select, MenuItem, Box, Typography, useTheme } from '@mui/material'; // v5.14.0
import { PaginationParams } from '../../../types/common';

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (params: PaginationParams) => void;
  className?: string;
  loading?: boolean;
  ariaLabel?: string;
}

/**
 * Memoized function to calculate available page size options based on total items
 * @param maxItems - Total number of items in the dataset
 * @returns Array of valid page size options
 */
const getPageSizeOptions = (maxItems: number): number[] => {
  const baseOptions = [10, 25, 50, 100];
  return baseOptions.filter(size => size <= maxItems || size === 10);
};

/**
 * Accessible pagination component for data tables with page size selection
 * Implements WCAG 2.1 AA standards with keyboard navigation and screen reader support
 * @param props - TablePaginationProps
 */
const TablePagination: React.FC<TablePaginationProps> = ({
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  className = '',
  loading = false,
  ariaLabel = 'Table pagination'
}) => {
  const theme = useTheme();

  // Calculate total pages with error handling
  const totalPages = useMemo(() => {
    if (total <= 0 || pageSize <= 0) return 1;
    return Math.ceil(total / pageSize);
  }, [total, pageSize]);

  // Memoize page size options
  const pageSizeOptions = useMemo(() => 
    getPageSizeOptions(total), [total]
  );

  // Handle page change with validation
  const handlePageChange = useCallback((
    _event: React.ChangeEvent<unknown>,
    newPage: number
  ) => {
    if (loading) return;
    onPageChange({
      page: newPage,
      pageSize,
      filters: {},
    });
  }, [loading, onPageChange, pageSize]);

  // Handle page size change with validation
  const handlePageSizeChange = useCallback((
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    if (loading) return;
    const newPageSize = Number(event.target.value);
    if (isNaN(newPageSize) || newPageSize <= 0) return;

    onPageChange({
      page: 1, // Reset to first page when changing page size
      pageSize: newPageSize,
      filters: {},
    });
  }, [loading, onPageChange]);

  // Styles following design system specifications
  const styles = {
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(2),
      minHeight: 64,
    },
    select: {
      marginRight: theme.spacing(2),
      minWidth: 120,
      '& .MuiSelect-select': {
        padding: theme.spacing(1),
      },
    },
    totalItems: {
      marginLeft: theme.spacing(2),
      color: theme.palette.text.secondary,
      ...theme.typography.body2,
    },
    screenReaderOnly: {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
      border: 0,
    },
  };

  return (
    <Box
      component="nav"
      sx={styles.container}
      className={className}
      aria-label={ariaLabel}
      role="navigation"
    >
      {/* Page size selector with accessibility support */}
      <Box component="div" sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography
          id="page-size-label"
          component="label"
          sx={styles.screenReaderOnly}
        >
          Items per page
        </Typography>
        <Select
          value={pageSize}
          onChange={handlePageSizeChange}
          disabled={loading}
          sx={styles.select}
          inputProps={{
            'aria-labelledby': 'page-size-label',
            'aria-label': 'Select number of items per page',
          }}
          MenuProps={{
            'aria-label': 'Page size options',
          }}
        >
          {pageSizeOptions.map(size => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* Pagination controls with keyboard navigation */}
      <Pagination
        page={page}
        count={totalPages}
        onChange={handlePageChange}
        disabled={loading}
        showFirstButton
        showLastButton
        siblingCount={1}
        boundaryCount={1}
        color="primary"
        size="medium"
        shape="rounded"
        aria-label="Navigation"
        getItemAriaLabel={(type, page, selected) => {
          if (type === 'page') {
            return `${selected ? 'Current page, ' : 'Go to '}page ${page}`;
          }
          return `Go to ${type} page`;
        }}
      />

      {/* Total items count with screen reader support */}
      <Typography
        component="div"
        sx={styles.totalItems}
        aria-live="polite"
        aria-atomic="true"
      >
        {total.toLocaleString()} items
      </Typography>

      {/* Loading state announcement for screen readers */}
      {loading && (
        <Typography sx={styles.screenReaderOnly} aria-live="polite">
          Loading table data
        </Typography>
      )}
    </Box>
  );
};

export default TablePagination;