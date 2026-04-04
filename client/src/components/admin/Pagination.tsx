import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * (pageSize ?? 15) + 1;
  const endItem = Math.min(currentPage * (pageSize ?? 15), totalItems ?? currentPage * (pageSize ?? 15));

  return (
    <div className="flex items-center justify-between px-2 py-3 border-t border-border/40">
      <div className="text-xs text-muted-foreground">
        {totalItems != null && pageSize != null && (
          <span>Showing {startItem}–{endItem} of {totalItems}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="h-8 w-8 flex items-center justify-center rounded-md text-xs font-medium disabled:opacity-30 hover:bg-muted transition-colors"
          aria-label="First page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 flex items-center justify-center rounded-md text-xs font-medium disabled:opacity-30 hover:bg-muted transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) {
            page = i + 1;
          } else if (currentPage <= 3) {
            page = i + 1;
          } else if (currentPage >= totalPages - 2) {
            page = totalPages - 4 + i;
          } else {
            page = currentPage - 2 + i;
          }
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                "h-8 w-8 flex items-center justify-center rounded-md text-xs font-medium transition-colors",
                page === currentPage
                  ? "bg-[#2C5234] text-white"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              {page}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 flex items-center justify-center rounded-md text-xs font-medium disabled:opacity-30 hover:bg-muted transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 flex items-center justify-center rounded-md text-xs font-medium disabled:opacity-30 hover:bg-muted transition-colors"
          aria-label="Last page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
