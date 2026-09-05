import { Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/client/cn";

export function ProductGridSkeleton({
  count = 9,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-[var(--color-line)] p-3">
          <Skeleton className="mb-3 aspect-[4/3] w-full" />
          <Skeleton className="mb-2 h-3.5 w-4/5" />
          <Skeleton className="mb-3 h-3 w-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="size-9 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
