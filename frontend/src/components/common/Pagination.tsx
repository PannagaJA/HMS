import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  variant?: 'card' | 'table-footer';
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemName = 'records',
  variant = 'card',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // Generate visible page numbers with smart ellipsis for desktop & tablet
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    pages.add(currentPage);
    if (currentPage > 1) pages.add(currentPage - 1);
    if (currentPage < totalPages) pages.add(currentPage + 1);

    return Array.from(pages).sort((a, b) => a - b);
  };

  const pageNumbers = getPageNumbers();

  const containerClasses =
    variant === 'table-footer'
      ? `px-4 sm:px-6 py-3.5 bg-slate-50/90 border-t border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3 select-none ${className}`
      : `bg-white px-4 sm:px-6 py-3.5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 select-none ${className}`;

  return (
    <div className={containerClasses}>
      {/* Top Row on Mobile / Left Section on Desktop */}
      <div className="flex items-center justify-between md:justify-start gap-3 w-full md:w-auto text-xs text-slate-500 font-medium">
        {/* Record count info */}
        <div className="text-slate-600 truncate">
          Showing <strong className="text-slate-900 font-bold">{startIndex}</strong>–
          <strong className="text-slate-900 font-bold">{endIndex}</strong> of{' '}
          <strong className="text-slate-900 font-bold">{totalItems}</strong>{' '}
          <span className="hidden xs:inline">{itemName}</span>
        </div>

        {/* Per page selector */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-2.5 py-1 shadow-2xs shrink-0">
          <span className="text-slate-500 font-medium text-[11px] sm:text-xs whitespace-nowrap">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-transparent border-0 font-bold text-slate-800 focus:outline-none cursor-pointer text-xs pr-1"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom Row on Mobile / Right Section on Desktop */}
      <div className="flex items-center justify-between sm:justify-end gap-2 w-full md:w-auto pt-2 md:pt-0 border-t border-slate-200/50 md:border-0">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer active:scale-95 min-h-[36px]"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
          <span>Previous</span>
        </button>

        {/* Center Page Numbers for Mobile (compact pill when > 4 pages) and Desktop */}
        <div className="flex items-center gap-1">
          {/* Mobile compact badge if many pages */}
          {totalPages > 4 ? (
            <>
              <div className="sm:hidden px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 min-h-[36px] flex items-center justify-center">
                <span>{currentPage} / {totalPages}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1">
                {pageNumbers.map((pageNum, idx, arr) => {
                  const prev = arr[idx - 1];
                  return (
                    <React.Fragment key={pageNum}>
                      {prev && pageNum - prev > 1 && (
                        <span className="px-1 text-slate-400 font-bold text-xs select-none">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => onPageChange(pageNum)}
                        className={`min-w-[34px] h-[36px] sm:min-w-[32px] sm:h-8 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                          currentPage === pageNum
                            ? 'bg-[#0B1437] text-white shadow-2xs font-extrabold border border-[#0B1437]'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
                        }`}
                      >
                        {pageNum}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          ) : (
            pageNumbers.map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[34px] h-[36px] sm:min-w-[32px] sm:h-8 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                  currentPage === pageNum
                    ? 'bg-[#0B1437] text-white shadow-2xs font-extrabold border border-[#0B1437]'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
                }`}
              >
                {pageNum}
              </button>
            ))
          )}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer active:scale-95 min-h-[36px]"
          title="Next Page"
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};
