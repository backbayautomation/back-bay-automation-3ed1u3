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

  // Handle page size change
  const handlePageSizeChange = useCallback((
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    if (loading) return;
    const newPageSize = Number(event.target.value);
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
        {/* Page size selector */}
        <Select
          value={pageSize}
          onChange={handlePageSizeChange}
          disabled={loading}
          sx={{
            marginRight: 2,
            minWidth: 120,
            '& .MuiSelect-select': { padding: 1 },
          }}
          aria-label="Items per page"
          inputProps={{
            'aria-label': 'Select number of items per page',
          }}
        >
          {pageSizeOptions.map(size => (
            <MenuItem key={size} value={size}>
              {size} items
            </MenuItem>
          ))}
        </Select>

        {/* Total items count */}
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
          }}
          component="span"
        >
          {/* Screen reader text */}
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
          >
            Total items:
          </span>
          {total} items
        </Typography>
      </Box>

      {/* Pagination controls */}
      <Pagination
        page={page}
        count={totalPages}
        onChange={handlePageChange}
        disabled={loading}
        color="primary"
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
        aria-label="Pagination navigation"
        role="navigation"
        getItemAriaLabel={(type, page, selected) => {
          if (type === 'page') {
            return `${selected ? 'Current page, ' : ''}Page ${page}`;
          }
          return `Go to ${type} page`;
        }}
      />
    </Box>
  );
};

export default TablePagination;