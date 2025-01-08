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

const useSortDirection = (
  columnId: string,
  currentSortBy: string,
  currentSortOrder: 'asc' | 'desc'
): 'asc' | 'desc' | false => {
  return useMemo(() => {
    if (columnId !== currentSortBy) return false;
    return currentSortOrder;
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
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  // Virtual scroll setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtual({
    size: data.length,
    parentRef: enableVirtualization ? parentRef : null,
    estimateSize: React.useCallback(() => virtualRowHeight, [virtualRowHeight]),
    overscan: 5,
  });

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

  const handleKeyboardSort = useCallback((
    event: React.KeyboardEvent<HTMLSpanElement>,
    columnId: string
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSort(columnId);
    }
  }, [handleSort]);

  const handleRowFocus = useCallback((index: number) => {
    setFocusedRowIndex(index);
  }, []);

  const styles = {
    tableContainer: {
      width: '100%',
      overflow: 'auto',
      position: 'relative',
      backgroundColor: '#ffffff',
    },
    headerCell: {
      fontWeight: 600,
      backgroundColor: '#f5f5f5',
      '&[aria-sort]:hover': {
        backgroundColor: '#e0e0e0',
      },
    },
    cell: {
      padding: '16px',
      '&[data-focus-visible]': {
        outline: '2px solid #0066CC',
      },
    },
    sortLabel: {
      marginLeft: '8px',
      '&[aria-sort]:focus': {
        outline: '2px solid #0066CC',
      },
    },
    loadingOverlay: {
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
    virtualizedContent: {
      position: 'relative',
      height: `${data.length * virtualRowHeight}px`,
      overflow: 'auto',
    },
  };

  return (
    <Paper elevation={0} className={className}>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={styles.tableContainer}
        ref={parentRef}
      >
        <Table
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-busy={loading}
          role="grid"
        >
          <TableHead role="rowgroup">
            <TableRow role="row">
              {columns.map(column => {
                const sortDirection = useSortDirection(column.id, sortBy, sortOrder);
                return (
                  <TableCell
                    key={column.id}
                    sx={styles.headerCell}
                    className={column.headerClassName}
                    role="columnheader"
                    aria-sort={sortDirection ? sortDirection : undefined}
                  >
                    {column.sortable ? (
                      <TableSortLabel
                        active={sortBy === column.id}
                        direction={sortDirection || 'asc'}
                        onClick={() => handleSort(column.id)}
                        IconComponent={ArrowUpward}
                        sx={styles.sortLabel}
                        aria-label={`Sort by ${column.ariaLabel || column.label}`}
                        onKeyDown={(e) => handleKeyboardSort(e, column.id)}
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

          <TableBody role="rowgroup">
            {data.length > 0 ? (
              enableVirtualization ? (
                rowVirtualizer.virtualItems.map(virtualRow => (
                  <TableRow
                    key={virtualRow.index}
                    role="row"
                    aria-rowindex={virtualRow.index + 1}
                    aria-label={getRowAriaLabel(data[virtualRow.index])}
                    onFocus={() => handleRowFocus(virtualRow.index)}
                    tabIndex={focusedRowIndex === virtualRow.index ? 0 : -1}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {columns.map(column => (
                      <TableCell
                        key={column.id}
                        sx={styles.cell}
                        className={column.cellClassName}
                        role="gridcell"
                      >
                        {column.render(data[virtualRow.index])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                data.map((item, index) => (
                  <TableRow
                    key={index}
                    role="row"
                    aria-rowindex={index + 1}
                    aria-label={getRowAriaLabel(item)}
                    onFocus={() => handleRowFocus(index)}
                    tabIndex={focusedRowIndex === index ? 0 : -1}
                  >
                    {columns.map(column => (
                      <TableCell
                        key={column.id}
                        sx={styles.cell}
                        className={column.cellClassName}
                        role="gridcell"
                      >
                        {column.render(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )
            ) : (
              <TableRow role="row">
                <TableCell
                  colSpan={columns.length}
                  align="center"
                  role="gridcell"
                  aria-label={emptyMessage}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {loading && (
          <Box sx={styles.loadingOverlay} role="status" aria-label="Loading data">
            <CircularProgress />
          </Box>
        )}
      </TableContainer>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        loading={loading}
        ariaLabel="Table navigation"
      />
    </Paper>
  );
};

export default DataTable;