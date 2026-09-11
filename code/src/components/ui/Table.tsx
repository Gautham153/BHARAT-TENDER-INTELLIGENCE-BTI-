import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedIds?: string[];
  onSelectRow?: (id: string) => void;
  onSelectAll?: () => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  isLoading?: boolean;
  emptyText?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };
  className?: string;
}

export function Table<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectedIds,
  onSelectRow,
  onSelectAll,
  sortColumn,
  sortDirection,
  onSort,
  isLoading = false,
  emptyText = 'No records found',
  pagination,
  className = '',
}: TableProps<T>) {
  const hasSelection = Boolean(onSelectRow);
  const allSelected = hasSelection && data.length > 0 && selectedIds?.length === data.length;

  return (
    <div className={`bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
              {hasSelection && (
                <th className="py-3.5 pl-4 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="w-4 h-4 rounded text-[#002B49] border-slate-300 focus:ring-[#002B49] cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3.5 px-4 font-semibold select-none ${col.className || ''} ${
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.sortable ? 'cursor-pointer hover:text-slate-900 transition-colors' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && onSort && onSort(col.key)}
                >
                  <div
                    className={`inline-flex items-center gap-1.5 ${
                      col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-slate-400">
                        {sortColumn === col.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-[#002B49]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#002B49]" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (hasSelection ? 1 : 0)} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="inline-block w-6 h-6 border-2 border-[#002B49] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading records...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasSelection ? 1 : 0)} className="py-12 text-center text-slate-500 text-sm">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const key = keyExtractor(item);
                const isSelected = selectedIds?.includes(key);

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={`transition-colors hover:bg-slate-50/75 group ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-blue-50/40' : index % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}
                  >
                    {hasSelection && (
                      <td
                        className="py-3 pl-4 pr-2 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRow && onSelectRow(key);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-[#002B49] border-slate-300 focus:ring-[#002B49] cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const value = (item as Record<string, unknown>)[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`py-3.5 px-4 text-slate-700 text-sm ${col.className || ''} ${
                            col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {col.render ? col.render(item, index) : (value as React.ReactNode)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{data.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{pagination.totalItems}</span> results
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => pagination.onPageChange(Math.max(pagination.currentPage - 1, 1))}
              disabled={pagination.currentPage <= 1}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-slate-700">
              Page {pagination.currentPage} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => pagination.onPageChange(Math.min(pagination.currentPage + 1, pagination.totalPages))}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
