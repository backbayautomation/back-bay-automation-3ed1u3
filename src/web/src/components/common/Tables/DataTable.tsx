import React, { useState, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
  Box,
  CircularProgress,
} from '@mui/material'; // v5.14.0
import { ArrowUpward } from '@mui/icons-material'; // v5.14.0
import { useVirtual } from 'react-virtual'; // v2.10.4

import TablePagination from './TablePagination';
import { PaginationParams } from '../../../types/common';

// Enhanced column interface with accessibility support
export interface Column<T> {
  id: string;
  label: string;
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
  ariaLabel?: string;
  headerClassName?: string;
  cellClassName?: string;
  customSort?: (a: T, b: T) => number;
}

// Enhanced props interface with accessibility and virtualization options
export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (params: PaginationParams) => void;
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
  enableVirtualization?: boolean;
  virtualRowHeight?: number;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  getRowAriaLabel?: (item: T) => string;
}

// Memoized hook for sort direction
const useSortDirection = (
  columnId: string,
  currentSortBy: string,
  currentSortOrder: 'asc' | 'desc'
): 'asc' | 'desc' | false => {
  return useMemo(() => {
    if (columnId === currentSortBy) {
      return currentSortOrder;
    }
    return false;
  }, [columnId, currentSortBy, currentSortOrder]);
};

const DataTable = <T extends Record<string, any>>({
  data,
  columns,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  className = '',
  loading = false,
  emptyMessage = 'No data available',
  enableVirtualization = false,
  virtualRowHeight = 52,
  ariaLabel = 'Data table',
  ariaLabelledBy,
  getRowAriaLabel = () => '',
}: DataTableProps<T>): JSX.Element => {
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Virtualization setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtual({
    size: data.length,
    parentRef: enableVirtualization ? parentRef : null,
    estimateSize: React.useCallback(() => virtualRowHeight, [virtualRowHeight]),
    overscan: 5,
  });

  // Handle sort column click
  const handleSort = useCallback((columnId: string) => {
    setSortBy(prevSortBy => {
      if (prevSortBy === columnId) {
        setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortOrder('asc');
      }
      return columnId;
    });

    onPageChange({
      page,
      pageSize,
      sortBy: columnId,
      sortOrder: sortBy === columnId && sortOrder === 'asc' ? 'desc' : 'asc',
      filters: {},
    });
  }, [page, pageSize, sortBy, sortOrder, onPageChange]);

  // Render table header
  const renderHeader = useCallback(() => (
    <TableHead>
      <TableRow>
        {columns.map(column => {
          const sortDirection = useSortDirection(column.id, sortBy, sortOrder);
          return (
            <TableCell
              key={column.id}
              className={column.headerClassName}
              sx={styles['table-header-cell']}
              sortDirection={sortDirection}
              aria-sort={
                sortDirection
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined
              }
            >
              {column.sortable ? (
                <TableSortLabel
                  active={sortBy === column.id}
                  direction={sortDirection || 'asc'}
                  onClick={() => handleSort(column.id)}
                  IconComponent={ArrowUpward}
                  sx={styles['sort-label']}
                  aria-label={`Sort by ${column.ariaLabel || column.label}`}
                >
                  {column.label}
                </TableSortLabel>
              ) : (
                column.label
              )}
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  ), [columns, sortBy, sortOrder, handleSort]);

  // Render table body
  const renderBody = useCallback(() => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length} align="center">
            <Box sx={styles['loading-overlay']}>
              <CircularProgress aria-label="Loading data" />
            </Box>
          </TableCell>
        </TableRow>
      );
    }

    if (!data.length) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length} sx={styles['empty-message']}>
            <span role="status">{emptyMessage}</span>
          </TableCell>
        </TableRow>
      );
    }

    const renderRows = enableVirtualization
      ? rowVirtualizer.virtualItems
      : data.map((_, index) => ({ index }));

    return renderRows.map(virtualRow => {
      const item = data[virtualRow.index];
      return (
        <TableRow
          key={virtualRow.index}
          sx={styles['table-row-hover']}
          aria-label={getRowAriaLabel(item)}
          style={
            enableVirtualization
              ? {
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }
              : undefined
          }
        >
          {columns.map(column => (
            <TableCell
              key={column.id}
              className={column.cellClassName}
              sx={styles['table-cell']}
            >
              {column.render(item)}
            </TableCell>
          ))}
        </TableRow>
      );
    });
  }, [
    data,
    columns,
    loading,
    emptyMessage,
    enableVirtualization,
    rowVirtualizer,
    getRowAriaLabel,
  ]);

  return (
    <Paper elevation={0} className={className}>
      <TableContainer
        sx={styles['table-container']}
        ref={parentRef}
        aria-busy={loading}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        <Table>
          {renderHeader()}
          <TableBody>{renderBody()}</TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        loading={loading}
        ariaLabel={`${ariaLabel} pagination`}
      />
    </Paper>
  );
};

// Styles following design system specifications
const styles = {
  'table-container': {
    width: '100%',
    overflow: 'auto',
    position: 'relative',
  },
  'table-header-cell': {
    fontWeight: 600,
    backgroundColor: '#f5f5f5',
    '&[aria-sort]:hover': {
      backgroundColor: '#e0e0e0',
    },
  },
  'table-cell': {
    padding: '16px',
    '&[data-focus-visible]:focus-within': {
      outline: '2px solid #0066CC',
    },
  },
  'table-row-hover': {
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.04)',
    },
    '&:focus-within': {
      backgroundColor: 'rgba(0, 102, 204, 0.08)',
    },
  },
  'sort-label': {
    marginLeft: '8px',
    '&[aria-sort]:focus': {
      outline: '2px solid #0066CC',
    },
  },
  'loading-overlay': {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  'empty-message': {
    textAlign: 'center',
    padding: '32px',
    color: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export default DataTable;