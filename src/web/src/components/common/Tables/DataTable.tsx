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
  total,
  onPageChange,
  className = '',
  loading = false,
  emptyMessage = 'No data available',
  enableVirtualization = false,
  virtualRowHeight = 52,
  ariaLabel = 'Data table',
  ariaLabelledBy,
  getRowAriaLabel = (item: T) => `Row ${item.id || ''}`,
}: DataTableProps<T>): JSX.Element => {
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  // Virtualization setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = enableVirtualization
    ? useVirtual({
        size: data.length,
        parentRef,
        estimateSize: React.useCallback(() => virtualRowHeight, [virtualRowHeight]),
        overscan: 5,
      })
    : null;

  const handleSort = useCallback(
    (columnId: string) => {
      const newSortOrder =
        columnId === sortBy && sortOrder === 'asc' ? 'desc' : 'asc';
      setSortBy(columnId);
      setSortOrder(newSortOrder);
      onPageChange({
        page,
        pageSize,
        sortBy: columnId,
        sortOrder: newSortOrder,
        filters: {},
      });
    },
    [sortBy, sortOrder, page, pageSize, onPageChange]
  );

  const handleKeyboardSort = useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>, columnId: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSort(columnId);
      }
    },
    [handleSort]
  );

  const handleRowFocus = useCallback((index: number) => {
    setFocusedRowIndex(index);
  }, []);

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (index < data.length - 1) {
            setFocusedRowIndex(index + 1);
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (index > 0) {
            setFocusedRowIndex(index - 1);
          }
          break;
      }
    },
    [data.length]
  );

  return (
    <div className={className}>
      <TableContainer
        component={Paper}
        sx={{
          width: '100%',
          overflow: 'auto',
          position: 'relative',
          '& .MuiTableCell-root': {
            padding: '16px',
          },
        }}
      >
        <Table
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-busy={loading}
        >
          <TableHead>
            <TableRow>
              {columns.map((column) => {
                const sortDirection = useSortDirection(
                  column.id,
                  sortBy,
                  sortOrder
                );
                return (
                  <TableCell
                    key={column.id}
                    className={column.headerClassName}
                    sx={{
                      fontWeight: 600,
                      backgroundColor: '#f5f5f5',
                      '&:hover': {
                        backgroundColor: column.sortable ? '#e0e0e0' : undefined,
                      },
                    }}
                  >
                    {column.sortable ? (
                      <TableSortLabel
                        active={sortDirection !== false}
                        direction={sortDirection || 'asc'}
                        onClick={() => handleSort(column.id)}
                        onKeyDown={(e) => handleKeyboardSort(e, column.id)}
                        IconComponent={ArrowUpward}
                        aria-label={`Sort by ${column.ariaLabel || column.label}`}
                        sx={{
                          '&.MuiTableSortLabel-root': {
                            '&:focus': {
                              outline: '2px solid #0066CC',
                              outlineOffset: '2px',
                            },
                          },
                        }}
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
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center">
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '2rem',
                    }}
                  >
                    <CircularProgress aria-label="Loading data" />
                  </Box>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  align="center"
                  sx={{
                    padding: '2rem',
                    color: 'rgba(0, 0, 0, 0.6)',
                  }}
                >
                  <Box role="status">{emptyMessage}</Box>
                </TableCell>
              </TableRow>
            ) : enableVirtualization && rowVirtualizer ? (
              <React.Fragment>
                {rowVirtualizer.virtualItems.map((virtualRow) => {
                  const item = data[virtualRow.index];
                  return (
                    <TableRow
                      key={virtualRow.index}
                      tabIndex={
                        focusedRowIndex === virtualRow.index ? 0 : -1
                      }
                      onFocus={() => handleRowFocus(virtualRow.index)}
                      onKeyDown={(e) =>
                        handleRowKeyDown(e, virtualRow.index)
                      }
                      aria-label={getRowAriaLabel(item)}
                      sx={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        },
                        '&:focus-within': {
                          backgroundColor: 'rgba(0, 102, 204, 0.08)',
                          outline: '2px solid #0066CC',
                          outlineOffset: '-2px',
                        },
                      }}
                    >
                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          className={column.cellClassName}
                        >
                          {column.render(item)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </React.Fragment>
            ) : (
              data.map((item, index) => (
                <TableRow
                  key={index}
                  tabIndex={focusedRowIndex === index ? 0 : -1}
                  onFocus={() => handleRowFocus(index)}
                  onKeyDown={(e) => handleRowKeyDown(e, index)}
                  aria-label={getRowAriaLabel(item)}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                    '&:focus-within': {
                      backgroundColor: 'rgba(0, 102, 204, 0.08)',
                      outline: '2px solid #0066CC',
                      outlineOffset: '-2px',
                    },
                  }}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={column.cellClassName}
                    >
                      {column.render(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        loading={loading}
        ariaLabel="Table pagination controls"
      />
    </div>
  );
};

export default DataTable;