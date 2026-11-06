import { cn } from "@/lib/utils"

// Placeholder block with a light sweeping shimmer, shown while content loads
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-200/80",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
