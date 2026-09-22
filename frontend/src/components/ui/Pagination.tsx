import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  windowSize?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  windowSize = 5,
}) => {
  const [windowStart, setWindowStart] = useState(1);

  useEffect(() => {
    setWindowStart((prev) => {
      if (currentPage < prev) {
        return Math.max(1, currentPage);
      } else if (currentPage >= prev + windowSize) {
        return currentPage;
      }
      return prev;
    });
  }, [currentPage, windowSize]);

  if (totalPages <= 1) return null;

  const startPage = windowStart;
  const endPage = Math.min(startPage + windowSize - 1, totalPages);

  const handlePageClick = (page: number) => {
    onPageChange(page);
    if (page === endPage && endPage < totalPages) {
      setWindowStart(endPage + 1);
    }
  };

  const handlePrevWindow = () => {
    setWindowStart((prev) => Math.max(1, prev - windowSize));
  };

  const handleJumpToLast = () => {
    const lastWindowStart = Math.floor((totalPages - 1) / windowSize) * windowSize + 1;
    onPageChange(totalPages);
    setWindowStart(lastWindowStart);
  };

  return (
    <div className="flex items-center gap-2 py-4 justify-end">
      {startPage > 1 && (
        <button
          onClick={handlePrevWindow}
          className="px-3 py-1 rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-700 transition-colors"
          title="Reveal previous pages to navigate to"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {Array.from({ length: endPage - startPage + 1 }, (_, i) => {
        const page = startPage + i;

        return (
          <button
            key={page}
            onClick={() => handlePageClick(page)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              currentPage === page
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
            }`}
          >
            {page}
          </button>
        );
      })}

      {endPage < totalPages && (
        <>
          <span className="text-zinc-500 font-medium">...</span>
          <button
            onClick={handleJumpToLast}
            className="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}
    </div>
  );
};
