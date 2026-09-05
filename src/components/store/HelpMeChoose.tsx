"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { getMenuIndex } from "@/lib/client/endpoints";
import type { MenuIndexItem } from "@/lib/client/types";
import { Sheet } from "@/components/ui/Overlay";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/client/cn";

type Mood = "spicy" | "meaty" | "seafood" | "light" | "sharing" | "surprise";
type Budget = "under5" | "5to15" | "over15" | "any";

const MOODS: { key: Mood; label: string; emoji: string }[] = [
  { key: "spicy", label: "Spicy", emoji: "🔥" },
  { key: "meaty", label: "Meaty", emoji: "🍖" },
  { key: "seafood", label: "Seafood", emoji: "🐟" },
  { key: "light", label: "Light", emoji: "🥗" },
  { key: "sharing", label: "Sharing", emoji: "👨‍👩‍👧‍👦" },
  { key: "surprise", label: "Surprise me", emoji: "🤷" },
];

const BUDGETS: { key: Budget; label: string }[] = [
  { key: "under5", label: "Under ₦5k" },
  { key: "5to15", label: "₦5k – ₦15k" },
  { key: "over15", label: "₦15k+" },
  { key: "any", label: "Any budget" },
];

const MOOD_MATCHERS: Record<Exclude<Mood, "surprise">, (t: string, tags: string[]) => boolean> = {
  spicy: (t, tags) => tags.includes("spicy") || /suya|pepper|asun|yaji|balangu/.test(t),
  meaty: (t, tags) =>
    tags.includes("meaty") || /beef|goat|ram|suya|asun|tozo|steak|tomahawk|turkey|guinea/.test(t),
  seafood: (t, tags) => tags.includes("seafood") || /fish|prawn|snail|croaker|catfish|tilapia/.test(t),
  light: (t, tags) => tags.includes("light") || /salad|smoothie|soup|mocktail|detox/.test(t),
  sharing: (t, tags) => tags.includes("shareable") || tags.includes("sharing") || /platter|combo/.test(t),
};

function inBudget(kobo: number, b: Budget): boolean {
  const naira = kobo / 100;
  if (b === "under5") return naira < 5000;
  if (b === "5to15") return naira >= 5000 && naira <= 15000;
  if (b === "over15") return naira > 15000;
  return true;
}

function pickForMood(menu: MenuIndexItem[], mood: Mood, budget: Budget): MenuIndexItem[] {
  const withinBudget = menu.filter((m) => inBudget(m.priceKobo, budget));
  const pool = withinBudget.length >= 3 ? withinBudget : menu;

  if (mood === "surprise") {
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  }
  const match = MOOD_MATCHERS[mood];
  const hits = pool.filter((m) => {
    const hay = `${m.name} ${(m.description ?? "")}`.toLowerCase();
    return match(hay, m.tags);
  });
  const chosen = (hits.length > 0 ? hits : pool).slice();
  chosen.sort((a, b) => a.priceKobo - b.priceKobo);
  // spread across the price range
  const step = Math.max(1, Math.floor(chosen.length / 4));
  const out: MenuIndexItem[] = [];
  for (let i = 0; i < chosen.length && out.length < 4; i += step) out.push(chosen[i]);
  return out;
}

export function HelpMeChoose() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<MenuIndexItem[] | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);

  useEffect(() => {
    if (open && menu === null) {
      getMenuIndex()
        .then((r) => setMenu(r.items))
        .catch(() => setMenu([]));
    }
  }, [open, menu]);

  const reset = () => {
    setMood(null);
    setBudget(null);
  };

  const results = useMemo(() => {
    if (!menu || !mood || !budget) return null;
    return pickForMood(menu, mood, budget);
  }, [menu, mood, budget]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]"
      >
        <Sparkle className="size-4 text-[var(--color-accent)]" weight="fill" aria-hidden />
        Help me choose
      </button>

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Help me choose"
        description="A couple of taps and we'll point you at something good."
      >
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {menu === null ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-[13px] font-medium text-[var(--color-text)]">
                  What are you in the mood for?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMood(m.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] transition-colors",
                        mood === m.key
                          ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)] text-[var(--color-text)]"
                          : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-line-strong)]",
                      )}
                    >
                      <span aria-hidden>{m.emoji}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {mood ? (
                <div>
                  <p className="mb-2 text-[13px] font-medium text-[var(--color-text)]">
                    What&apos;s your budget?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {BUDGETS.map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => setBudget(b.key)}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-[13px] transition-colors",
                          budget === b.key
                            ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)] text-[var(--color-text)]"
                            : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-line-strong)]",
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {results ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[13px] font-medium text-[var(--color-text)]">
                      Our picks for you
                    </p>
                    <button
                      type="button"
                      onClick={reset}
                      className="text-[12px] text-[var(--color-accent)] hover:underline"
                    >
                      Start over
                    </button>
                  </div>
                  {results.length === 0 ? (
                    <p className="text-[13px] text-[var(--color-muted)]">
                      Nothing matched that combination — try a wider budget.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {results.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-line)] px-5 py-3">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Close
          </Button>
        </div>
      </Sheet>
    </>
  );
}
