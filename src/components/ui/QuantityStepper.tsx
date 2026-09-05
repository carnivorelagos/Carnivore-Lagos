"use client";

import { Minus, Plus, Trash } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 50,
  removable = false,
  onRemove,
  size = "md",
  ariaLabel = "Quantity",
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  removable?: boolean;
  onRemove?: () => void;
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}) {
  const atMin = value <= min;
  const atMax = value >= max;
  const btn =
    "grid place-items-center text-[var(--color-text)] transition-colors disabled:opacity-35 " +
    "hover:bg-[color-mix(in_oklab,var(--color-muted)_14%,transparent)] disabled:hover:bg-transparent " +
    "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus)]";
  const dims = size === "sm" ? "size-8" : "size-10";
  const decIcon = removable && atMin ? <Trash className="size-4" /> : <Minus className="size-4" />;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)]",
        className,
      )}
    >
      <button
        type="button"
        className={cn(btn, dims, "rounded-l-md")}
        onClick={() => {
          if (removable && atMin) onRemove?.();
          else onChange(Math.max(min, value - 1));
        }}
        disabled={atMin && !removable}
        aria-label={removable && atMin ? "Remove item" : "Decrease quantity"}
      >
        {decIcon}
      </button>
      <span
        className={cn(
          "tnum min-w-9 select-none text-center font-mono text-sm text-[var(--color-text)]",
        )}
        aria-live="polite"
        aria-label={`${ariaLabel}: ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        className={cn(btn, dims, "rounded-r-md")}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={atMax}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
