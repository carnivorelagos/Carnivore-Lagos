"use client";

import { forwardRef, useEffect, useState } from "react";
import { cn } from "@/lib/client/cn";
import { buttonVariants, type Size, type Variant } from "./buttonVariants";

// Re-exported so existing client imports (`from "@/components/ui/Button"`)
// keep working. Server Components must import from "./buttonVariants".
export { buttonVariants };
export type { Size, Variant };

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  /**
   * Shown next to an inline spinner while `loading` — a specific label for
   * a known-slow action ("Placing your order…") instead of a bare spinner.
   */
  pendingLabel?: React.ReactNode;
  /** Replaces `pendingLabel` once the wait passes `slowAfterMs`. */
  slowLabel?: React.ReactNode;
  slowAfterMs?: number;
};

const SPINNER =
  "size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth,
    loading = false,
    icon,
    iconRight,
    pendingLabel,
    slowLabel,
    slowAfterMs = 4500,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading || slowLabel == null) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), slowAfterMs);
    return () => clearTimeout(t);
  }, [loading, slowLabel, slowAfterMs]);

  // Labelled loading: inline spinner + a specific message, message visible.
  const labelled = loading && (pendingLabel != null || slowLabel != null);
  const message = slow && slowLabel != null ? slowLabel : (pendingLabel ?? children);

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && !labelled ? <span aria-hidden className={cn(SPINNER, "absolute")} /> : null}
      <span
        className={cn("inline-flex items-center gap-2", loading && !labelled && "opacity-0")}
        aria-live={labelled ? "polite" : undefined}
      >
        {loading && labelled ? (
          <span aria-hidden className={SPINNER} />
        ) : icon ? (
          <span className="-ml-0.5 shrink-0">{icon}</span>
        ) : null}
        {labelled ? (
          <span key={slow ? "slow" : "pending"} className="animate-fade">
            {message}
          </span>
        ) : (
          children
        )}
        {!loading && iconRight ? <span className="-mr-0.5 shrink-0">{iconRight}</span> : null}
      </span>
    </button>
  );
});
