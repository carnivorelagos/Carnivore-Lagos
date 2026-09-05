"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { getProducts } from "@/lib/client/endpoints";
import { ProductCard } from "@/components/store/ProductCard";
import { Skeleton } from "@/components/ui/feedback";

/**
 * Home-page taste of the menu. Real data from /api/products. If it can't
 * load, the section removes itself rather than showing an error on the
 * landing page.
 */
export function FeaturedGrill() {
  const { data, status } = useAsyncData(() => getProducts({ limit: 6 }), []);

  if (status === "error" || (status === "ready" && (data?.items.length ?? 0) === 0)) {
    return null;
  }

  return (
    <section className="shell gutter py-14 sm:py-20">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="font-display text-2xl sm:text-3xl">Off the coals</h2>
        <Link
          href="/menu"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          Full menu
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

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
    </section>
  );
}
