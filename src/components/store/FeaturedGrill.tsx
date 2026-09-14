"use client";

import Link from "next/link";
import { ArrowRight, ForkKnife } from "@phosphor-icons/react";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { getProducts } from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { ProductCard } from "@/components/store/ProductCard";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/client/cn";

/**
 * A taste of the menu, real data from /api/products. `standalone` marks
 * it as the entire page's content (the home page, menu-first per the
 * client's request) rather than one section among several: instead of
 * quietly hiding on error/empty, it shows a proper error/empty state so
 * the home page never renders as a blank gap between header and footer.
 */
export function FeaturedGrill({ standalone = false }: { standalone?: boolean } = {}) {
  const { data, status, error, reload } = useAsyncData(() => getProducts({ limit: 6 }), []);

  const isEmpty = status === "ready" && (data?.items.length ?? 0) === 0;

  if (!standalone && (status === "error" || isEmpty)) {
    return null;
  }

  return (
    <section className={cn("shell gutter py-14 sm:py-20", standalone && "pt-8 sm:pt-14")}>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2 text-[var(--color-subtle)]">Straight from the grill</p>
          {standalone ? (
            <h1 className="font-display text-2xl uppercase leading-none tracking-[0.01em] sm:text-4xl">
              Off the coals
            </h1>
          ) : (
            <h2 className="font-display text-2xl uppercase leading-none tracking-[0.01em] sm:text-4xl">
              Off the coals
            </h2>
          )}
        </div>
        <Link
          href="/menu"
          className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          Full menu
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      {status === "error" ? (
        <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
      ) : isEmpty ? (
        <EmptyState
          icon={ForkKnife}
          title="The menu is being set up"
          description="Check back shortly, or see the full menu."
          action={
            <Link
              href="/menu"
              className="text-[13px] font-semibold text-[var(--color-accent)] hover:underline"
            >
              Full menu
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {status === "loading"
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-[var(--color-line)] p-3">
                  <Skeleton className="mb-3 aspect-[4/3] w-full" />
                  <Skeleton className="mb-2 h-3.5 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              ))
            : data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </section>
  );
}
