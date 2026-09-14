"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ForkKnife } from "@phosphor-icons/react";
import { getCategories, getProducts } from "@/lib/client/endpoints";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { errorMessage } from "@/lib/client/errors";
import type { ProductListItem } from "@/lib/client/types";
import { CategoryNav } from "@/components/store/CategoryNav";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductGridSkeleton } from "@/components/store/ProductGridSkeleton";
import { SmartSearch } from "@/components/store/SmartSearch";
import { HelpMeChoose } from "@/components/store/HelpMeChoose";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/Button";
import { PLACEHOLDER_IMAGES } from "@/lib/client/brand";

const PAGE_SIZE = 24;

function MenuBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("category");
  const [searching, setSearching] = useState(false);

  const categories = useAsyncData(() => getCategories(), []);

  const [items, setItems] = useState<ProductListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [listStatus, setListStatus] = useState<"loading" | "more" | "error" | "ready">("loading");
  const [listError, setListError] = useState<unknown>(null);
  const runId = useRef(0);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      const id = ++runId.current;
      setListStatus(replace ? "loading" : "more");
      setListError(null);
      try {
        const res = await getProducts({
          categoryId: activeId ?? undefined,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        if (id !== runId.current) return;
        setTotal(res.total);
        setPage(res.page);
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setListStatus("ready");
      } catch (e) {
        if (id !== runId.current) return;
        setListError(e);
        setListStatus("error");
      }
    },
    [activeId],
  );

  useEffect(() => {
    void fetchPage(1, true);
  }, [fetchPage]);

  const selectCategory = useCallback(
    (id: string | null) => {
      const qs = id ? `?category=${id}` : "";
      router.replace(`${pathname}${qs}`, { scroll: false });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [router, pathname],
  );

  const activeCategoryName = useMemo(
    () => categories.data?.find((c) => c.id === activeId)?.name ?? null,
    [categories.data, activeId],
  );

  const hasMore = items.length < total;

  return (
    <>
      {!searching ? (
        <CategoryNav
          categories={categories.data ?? []}
          activeId={activeId}
          onSelect={selectCategory}
        />
      ) : null}

      <div className="shell gutter py-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SmartSearch onActiveChange={setSearching} />
          </div>
          <div className="shrink-0 pt-0.5">
            <HelpMeChoose />
          </div>
        </div>

        {searching ? null : (
          <>
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h1 className="font-display text-2xl sm:text-3xl">
                {activeCategoryName ?? "The full menu"}
              </h1>
              {listStatus === "ready" && total > 0 ? (
                <span className="tnum text-[13px] text-[var(--color-subtle)]">
                  {total} item{total === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            {listStatus === "loading" ? (
          <ProductGridSkeleton count={12} />
        ) : listStatus === "error" ? (
          <ErrorState description={errorMessage(listError)} onRetry={() => fetchPage(1, true)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={ForkKnife}
            title="Nothing here yet"
            description={
              activeCategoryName
                ? `No items in ${activeCategoryName} right now. Try another part of the menu.`
                : "The menu is being set up. Check back shortly."
            }
            action={
              activeId ? (
                <Button variant="secondary" onClick={() => selectCategory(null)}>
                  See the whole menu
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 animate-reveal sm:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {hasMore ? (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="secondary"
                  size="lg"
                  loading={listStatus === "more"}
                  onClick={() => fetchPage(page + 1, false)}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        )}
          </>
        )}
      </div>
    </>
  );
}

export default function MenuPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-[var(--color-line)]">
        <Image
          src={PLACEHOLDER_IMAGES.menuHero.src}
          alt={PLACEHOLDER_IMAGES.menuHero.alt}
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-bg)_60%,transparent),color-mix(in_oklab,var(--color-bg)_92%,transparent))]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(100%_80%_at_85%_0%,color-mix(in_oklab,var(--color-accent)_18%,transparent),transparent_60%)]"
        />
        <div className="shell gutter py-12 sm:py-16">
          <p className="eyebrow flex items-center gap-3 text-[var(--color-bone)]">
            <span aria-hidden className="h-px w-8 bg-[var(--color-accent)]" />
            Order ahead
          </p>
          <h2 className="display mt-3 max-w-[16ch] text-[2rem] leading-[0.92] sm:text-[3.25rem]">
            Everything off the grill
          </h2>
        </div>
      </section>

      <Suspense fallback={<div className="shell gutter py-10"><ProductGridSkeleton count={12} /></div>}>
        <MenuBrowser />
      </Suspense>
    </>
  );
}
