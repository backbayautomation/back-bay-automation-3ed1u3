import React, { useMemo, useCallback } from 'react';
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

const getPageSizeOptions = (maxItems: number): number[] => {
  const baseOptions = [10, 25, 50, 100];
  return baseOptions.filter(size => size <= maxItems || maxItems === 0);
};

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
    if (total === 0 || pageSize === 0) return 0;
    return Math.ceil(total / pageSize);
  }, [total, pageSize]);

  // Memoize page size options
  const pageSizeOptions = useMemo(() => getPageSizeOptions(total), [total]);

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
    if (isNaN(newPageSize) || newPageSize < 1) return;

    onPageChange({
      page: 1, // Reset to first page when changing page size
      pageSize: newPageSize,
      filters: {},
    });
  }, [loading, onPageChange]);

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 2, // 16px (base unit: 8px * 2)
        minHeight: 64,
      }}
      role="navigation"
      aria-label={ariaLabel}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography
          component="label"
          htmlFor="page-size-select"
          sx={{
            marginRight: 1,
            color: theme.palette.text.secondary,
            typography: 'body2',
          }}
        >
          Rows per page:
        </Typography>
        <Select
          id="page-size-select"
          value={pageSize}
          onChange={handlePageSizeChange}
          disabled={loading}
          size="small"
          sx={{
            marginRight: 2,
            minWidth: 120,
            '& .MuiSelect-select': {
              padding: 1, // 8px (base unit)
            },
          }}
          aria-label="Select number of rows per page"
        >
          {pageSizeOptions.map(size => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Pagination
        page={page}
        count={totalPages}
        onChange={handlePageChange}
        disabled={loading}
        color="primary"
        size="medium"
        showFirstButton
        showLastButton
        siblingCount={1}
        boundaryCount={1}
        sx={{
          '& .MuiPaginationItem-root': {
            color: theme.palette.text.primary,
            '&.Mui-selected': {
              backgroundColor: '#0066CC',
              color: theme.palette.common.white,
              '&:hover': {
                backgroundColor: '#0052A3',
              },
            },
          },
        }}
        aria-label="Navigate table pages"
      />

      <Typography
        variant="body2"
        sx={{
          marginLeft: 2,
          color: theme.palette.text.secondary,
        }}
        role="status"
        aria-live="polite"
      >
        {total} {total === 1 ? 'item' : 'items'} total
      </Typography>

      {/* Screen reader only text for loading state */}
      {loading && (
        <span
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            border: 0,
          }}
          role="alert"
          aria-live="assertive"
        >
          Loading table data
        </span>
      )}
    </Box>
  );
};

export default TablePagination;