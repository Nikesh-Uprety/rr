import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 15, 20, 25, 50, 100];

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems = 0,
  pageSize = 15,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const safeTotalPages = Math.max(totalPages, 1);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pageButtons = [];
  const windowStart = Math.max(1, currentPage - 1);
  const windowEnd = Math.min(safeTotalPages, windowStart + 2);
  const adjustedStart = Math.max(1, windowEnd - 2);

  for (let page = adjustedStart; page <= windowEnd; page += 1) {
    pageButtons.push(page);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          Showing {startItem}-{endItem} of {totalItems}
        </span>

        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span>Per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                onPageSizeChange(Number(value));
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-8 w-[84px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {adjustedStart > 1 ? (
          <>
            <Button variant="outline" size="sm" className="h-8 min-w-8 px-2" onClick={() => onPageChange(1)}>
              1
            </Button>
            {adjustedStart > 2 ? <span className="px-1 text-sm text-muted-foreground">…</span> : null}
          </>
        ) : null}

        {pageButtons.map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            className="h-8 min-w-8 px-2"
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        ))}

        {windowEnd < safeTotalPages ? (
          <>
            {windowEnd < safeTotalPages - 1 ? <span className="px-1 text-sm text-muted-foreground">…</span> : null}
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-8 px-2"
              onClick={() => onPageChange(safeTotalPages)}
            >
              {safeTotalPages}
            </Button>
          </>
        ) : null}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= safeTotalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
