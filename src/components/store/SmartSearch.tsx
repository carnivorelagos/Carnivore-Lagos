"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, Sparkle, X } from "@phosphor-icons/react";
import { getMenuIndex, searchAssist } from "@/lib/client/endpoints";
import type { AssistResult, MenuIndexItem } from "@/lib/client/types";
import { runSearch, POPULAR_SEARCHES, type SearchOutcome } from "@/lib/client/search";
import { ProductCard } from "@/components/store/ProductCard";
import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/client/cn";

function Grid({ items }: { items: MenuIndexItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function ConciergePanel({ query, onDismiss }: { query: string; onDismiss: () => void }) {
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [result, setResult] = useState<AssistResult | null>(null);

  useEffect(() => {
    let live = true;
    setState("loading");
    searchAssist(query)
      .then((r) => {
        if (!live) return;
        setResult(r);
        setState("done");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [query]);

  if (state === "loading") {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-muted)]">
        <Spinner /> Thinking about what would suit you…
      </div>
    );
  }
  if (state === "error" || !result || !result.available) {
    return (
      <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-[13px] text-[var(--color-muted)]">
        We couldn&apos;t put together a suggestion just now. Try one of the popular searches above,
        or browse the full menu.
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            Back to search
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-[color-mix(in_oklab,var(--color-gold,var(--color-accent))_35%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_5%,transparent)] p-5">
      <p className="flex items-center gap-2 font-display text-lg text-[var(--color-text)]">
        <Sparkle className="size-4 text-[var(--color-accent)]" weight="fill" aria-hidden />
        {result.intro}
      </p>
      {result.note ? (
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">{result.note}</p>
      ) : null}
      <ul className="mt-4 space-y-2.5">
        {result.picks.map((p) => (
          <li
            key={p.productId}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3"
          >
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt=""
                className="size-14 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
            ) : (
              <div className="size-14 shrink-0 rounded-md bg-[var(--color-bg)]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-text)]">{p.name}</p>
              <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{p.reason}</p>
            </div>
            <Money kobo={p.priceKobo} size="sm" />
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Button size="sm" variant="secondary" onClick={onDismiss}>
          New search
        </Button>
      </div>
    </div>
  );
}

function Results({
  outcome,
  query,
  onAskConcierge,
  onPick,
}: {
  outcome: SearchOutcome;
  query: string;
  onAskConcierge: () => void;
  onPick: (q: string) => void;
}) {
  if (outcome.kind === "results") {
    return (
      <div className="mt-5">
        <p className="mb-3 text-[13px] text-[var(--color-subtle)]">
          {outcome.items.length} match{outcome.items.length === 1 ? "" : "es"} for “{query}”
        </p>
        <Grid items={outcome.items} />
        {/* AI concierge prompt disabled per client request (not needed for
            now) — see the ConciergePanel/ConciergePrompt definitions above
            for how to bring it back.
        <ConciergePrompt onAskConcierge={onAskConcierge} />
        */}
      </div>
    );
  }

  if (outcome.kind === "did-you-mean") {
    return (
      <div className="mt-5">
        <p className="mb-3 text-[13px] text-[var(--color-muted)]">
          Did you mean{" "}
          <button
            type="button"
            onClick={() => onPick(outcome.suggestion)}
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            {outcome.suggestion}
          </button>
          ?
        </p>
        <Grid items={outcome.items} />
        {/* <ConciergePrompt onAskConcierge={onAskConcierge} /> */}
      </div>
    );
  }

  if (outcome.kind !== "no-match") return null;

  return (
    <div className="mt-5">
      <p className="text-sm text-[var(--color-text)]">
        We don&apos;t have <span className="font-medium">“{outcome.query}”</span> on the menu right
        now.
      </p>
      {outcome.alternatives.length > 0 ? (
        <>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">But you might like these:</p>
          <div className="mt-3">
            <Grid items={outcome.alternatives} />
          </div>
        </>
      ) : null}
      {/* <ConciergePrompt onAskConcierge={onAskConcierge} emphatic /> */}
    </div>
  );
}

function ConciergePrompt({
  onAskConcierge,
  emphatic = false,
}: {
  onAskConcierge: () => void;
  emphatic?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAskConcierge}
      className={cn(
        "mt-5 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] transition-colors",
        emphatic
          ? "border-[var(--color-accent)] text-[var(--color-text)] hover:bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)]"
          : "border-[var(--color-line-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]",
      )}
    >
      <Sparkle className="size-4 text-[var(--color-accent)]" weight="fill" aria-hidden />
      Not quite it? Tell us what you&apos;re craving →
    </button>
  );
}

export function SmartSearch({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [menu, setMenu] = useState<MenuIndexItem[] | null>(null);
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [concierge, setConcierge] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMenuIndex()
      .then((r) => setMenu(r.items))
      .catch(() => setMenu([]));
  }, []);

  // Debounce the committed query.
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw.trim()), 220);
    return () => clearTimeout(t);
  }, [raw]);

  useEffect(() => {
    onActiveChange?.(query.length > 0);
  }, [query, onActiveChange]);

  const outcome = useMemo<SearchOutcome | null>(() => {
    if (!menu || query.length === 0) return null;
    return runSearch(query, menu);
  }, [menu, query]);

  const pick = useCallback((q: string) => {
    setRaw(q);
    setQuery(q);
    setConcierge(false);
    inputRef.current?.focus();
  }, []);

  const clear = () => {
    setRaw("");
    setQuery("");
    setConcierge(false);
  };

  return (
    <div>
      <div className="relative">
        <MagnifyingGlass
          className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[var(--color-subtle)]"
          aria-hidden
        />
        <input
          ref={inputRef}
          // "text", not "search" — type="search" adds the browser's own
          // native clear button on top of the custom one below, showing
          // two X icons in the same corner.
          type="text"
          enterKeyHint="search"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="What are you craving?"
          aria-label="Search the menu"
          // 16px, not 15 — under 16px, iOS Safari/Chrome auto-zoom the page on focus (see form.tsx).
          className="h-12 w-full rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface)] pl-11 pr-10 text-base text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]"
        />
        {raw ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--color-subtle)] hover:text-[var(--color-text)]"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {query.length === 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-[var(--color-subtle)]">Popular:</span>
          {POPULAR_SEARCHES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => pick(p)}
              className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[12px] text-[var(--color-muted)] transition-colors hover:border-[var(--color-line-strong)] hover:text-[var(--color-text)]"
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      {menu && query.length > 0 && !outcome ? (
        <div className="mt-6 flex justify-center">
          <Spinner />
        </div>
      ) : null}

      {/* AI concierge disabled per client request (not needed for now) —
          was: `concierge && query.length > 0 ? <ConciergePanel .../> : `
          gating the Results branch below. See ConciergePanel/
          ConciergePrompt above to bring it back. */}
      {outcome && outcome.kind !== "empty" ? (
        <Results
          outcome={outcome}
          query={query}
          onAskConcierge={() => setConcierge(true)}
          onPick={pick}
        />
      ) : null}
    </div>
  );
}
