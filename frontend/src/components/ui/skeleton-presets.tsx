import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Ready-made skeleton layouts so every admin screen loads the same way.

/** A list of rows (avatar + two text lines + trailing pill), for tables and lists */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="hidden h-8 w-20 rounded-lg sm:block" />
        </div>
      ))}
    </div>
  );
}

/** A grid of cards, for card-based pages */
export function CardGridSkeleton({ cards = 6, className }: { cards?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-xl border border-slate-100 bg-white p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** A few text lines, for small panels and previews */
export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Whole admin page: sidebar placeholder, title, and a list or card body */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "cards" }) {
  return (
    <div className="min-h-screen bg-slate-50" aria-busy="true" aria-label="Loading page">
      <aside className="fixed inset-y-0 left-0 hidden w-64 space-y-4 border-r border-slate-200 bg-white p-5 md:block">
        <Skeleton className="mb-6 h-8 w-32" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-lg" />
        ))}
      </aside>
      <main className="space-y-6 p-4 md:ml-64 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          {variant === "cards" ? <CardGridSkeleton /> : <ListSkeleton rows={6} />}
        </div>
      </main>
    </div>
  );
}
