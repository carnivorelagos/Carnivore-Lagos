"use client";

import { cn } from "@/lib/client/cn";
import type { Category } from "@/lib/client/types";

/**
 * Horizontal scroll-snap category rail. Sticks just under the header so
 * it stays reachable while scrolling a long menu.
 */
export function CategoryNav({
  categories,
  activeId,
  onSelect,
}: {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const pill = (active: boolean) =>
    cn(
      "shrink-0 snap-start whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors",
      active
        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
        : "border-[var(--color-line-strong)] text-[var(--color-muted)] hover:border-[var(--color-muted)] hover:text-[var(--color-text)]",
    );

  return (
    <div className="sticky top-14 z-40 -mx-[1px] border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_88%,transparent)] backdrop-blur-md sm:top-16">
      <div className="shell gutter">
        <div
          className="flex snap-x gap-2 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Menu categories"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeId === null}
            className={pill(activeId === null)}
            onClick={() => onSelect(null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={activeId === c.id}
              className={pill(activeId === c.id)}
              onClick={() => onSelect(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
