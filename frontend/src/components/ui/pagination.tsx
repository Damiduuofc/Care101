"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const totalPagesFor = (total: number, pageSize: number) =>
  Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));

/** Client-side helper: the items on `page` (1-based) of an already-loaded list. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Page state for a list. Resets to page 1 when any value in `resetOn` changes
 * (search text, filters, sort) and pulls the page back in range when the total shrinks
 * (e.g. after a delete or a live refresh).
 */
export function usePagination(total: number, { pageSize: initialSize = 20, resetOn = [] as unknown[] } = {}) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialSize);
  const resetKey = JSON.stringify(resetOn);
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [resetKey, pageSize]);

  const totalPages = totalPagesFor(total, pageSize);
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return { page, setPage, pageSize, setPageSize, totalPages };
}

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Label for the counted things, e.g. "bookings" */
  itemLabel?: string;
  /** Smaller layout for narrow side panels */
  compact?: boolean;
  className?: string;
};

const pageWindow = (page: number, totalPages: number): (number | "…")[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push("…");
  pages.push(totalPages);
  return pages;
};

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  itemLabel = "items",
  compact = false,
  className,
}: PaginationProps) {
  const totalPages = totalPagesFor(total, pageSize);
  const current = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);
  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    if (next !== current) onPageChange(next);
  };

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600 transition-colors hover:border-cyan-300 hover:text-cyan-700 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500";

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500",
        compact ? "flex-col px-2" : "flex-col sm:flex-row",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span aria-live="polite">
          {total === 0 ? `No ${itemLabel}` : `${from}–${to} of ${total.toLocaleString()} ${itemLabel}`}
        </span>
        {onPageSizeChange && !compact && (
          <label className="flex items-center gap-1.5">
            <span className="sr-only sm:not-sr-only">Per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {!compact && (
            <button type="button" className={btn} onClick={() => go(1)} disabled={current === 1} aria-label="First page">
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
          <button type="button" className={btn} onClick={() => go(current - 1)} disabled={current === 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {compact ? (
            <span className="px-2 tabular-nums">
              {current} / {totalPages}
            </span>
          ) : (
            pageWindow(current, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => go(p)}
                  aria-current={p === current ? "page" : undefined}
                  className={cn(btn, "tabular-nums", p === current && "border-cyan-600 bg-cyan-600 text-white hover:text-white")}
                >
                  {p}
                </button>
              )
            )
          )}
          <button type="button" className={btn} onClick={() => go(current + 1)} disabled={current === totalPages} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
          {!compact && (
            <button type="button" className={btn} onClick={() => go(totalPages)} disabled={current === totalPages} aria-label="Last page">
              <ChevronsRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
