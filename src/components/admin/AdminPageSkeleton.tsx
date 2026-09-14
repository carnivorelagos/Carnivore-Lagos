import { Skeleton } from "@/components/ui/feedback";

/**
 * Generic admin page loading skeleton — a page-header block over a table.
 * Used by `admin/loading.tsx` (covers every admin route) and by the
 * individual pages' own loading branches.
 */
export function AdminPageSkeleton({
  rows = 8,
  header = true,
}: {
  rows?: number;
  header?: boolean;
}) {
  return (
    <div aria-hidden>
      {header ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2.5">
          <Skeleton className="h-3 w-32" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[var(--color-line)] px-3 py-3 last:border-0">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="ml-auto h-3.5 w-16" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
