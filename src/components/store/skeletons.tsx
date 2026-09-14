import { Skeleton } from "@/components/ui/feedback";
import { ProductGridSkeleton } from "@/components/store/ProductGridSkeleton";

/**
 * Layout-shaped loading skeletons, one per storefront route. Each is used
 * in two places that must look identical so there's no seam:
 *   - the route's `loading.tsx` (server-streamed, shows on navigation)
 *   - the page's own `useAsyncData` loading branch (shows during the fetch)
 * Server Components (no hooks) so `loading.tsx` can render them directly.
 */

export function MenuSkeleton() {
  return (
    <div className="shell gutter py-6 sm:py-8" aria-hidden>
      <Skeleton className="h-11 w-full max-w-md rounded-lg" />
      <div className="mt-5 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-6">
        <ProductGridSkeleton count={12} />
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="shell gutter grid gap-8 py-8 sm:grid-cols-2 sm:py-12" aria-hidden>
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="flex flex-col gap-4 sm:pt-6">
        <Skeleton className="h-8 w-3/4" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <Skeleton className="mt-2 h-6 w-24" />
        <Skeleton className="mt-4 h-12 w-full max-w-xs rounded-md" />
      </div>
    </div>
  );
}

export function OrderTrackingSkeleton() {
  return (
    <div className="shell gutter max-w-2xl py-8 sm:py-12" aria-hidden>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="mt-8 space-y-3">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <Skeleton className="mb-4 h-4 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-2.5 flex justify-between">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="shell gutter max-w-2xl py-8 sm:py-12" aria-hidden>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-2 h-3.5 w-64" />
      <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3.5 w-full max-w-sm" />
        <Skeleton className="mt-4 h-11 w-full max-w-xs rounded-md" />
      </div>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-2.5 h-3.5 w-3/4" />
            <div className="mt-3 flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CheckoutSkeleton() {
  return (
    <div className="shell gutter py-6 sm:py-10" aria-hidden>
      <Skeleton className="mb-6 h-9 w-40" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-8">
          <div>
            <Skeleton className="mb-3 h-5 w-40" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-5 w-24" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-11 rounded-md" />
              <Skeleton className="h-11 rounded-md" />
            </div>
            <Skeleton className="h-11 rounded-md" />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <Skeleton className="h-5 w-20" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
          <Skeleton className="mt-5 h-px w-full" />
          <Skeleton className="mt-5 h-7 w-32" />
          <Skeleton className="mt-4 h-12 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div className="shell gutter py-6 sm:py-10" aria-hidden>
      <Skeleton className="mb-6 h-9 w-32" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-[var(--color-line)] p-3">
              <Skeleton className="size-20 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3.5 w-1/4" />
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-4 h-7 w-32" />
          <Skeleton className="mt-4 h-12 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
