"use client";

import { useId } from "react";
import { cn } from "@/lib/client/cn";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[13px] font-medium text-text">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-[12px] text-muted">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
          disabled && "opacity-50",
          checked
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
            : "border-line-strong bg-bg",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[1.15rem]" : "translate-x-[0.15rem]",
          )}
        />
      </button>
    </div>
  );
}
