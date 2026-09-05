import { cn } from "@/lib/client/cn";
import { formatNaira } from "@/lib/client/format";

/**
 * Every price on the site. Tabular figures + mono so columns of prices
 * align and never jitter; the naira mark stays with the number.
 */
export function Money({
  kobo,
  className,
  size = "md",
  muted = false,
  strike = false,
}: {
  kobo: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "display";
  muted?: boolean;
  strike?: boolean;
}) {
  const sizeClass = {
    sm: "text-[13px]",
    md: "text-[15px]",
    lg: "text-lg",
    display: "text-2xl",
  }[size];

  return (
    <span
      className={cn(
        "tnum font-mono tracking-tight",
        sizeClass,
        muted ? "text-[var(--color-muted)]" : "text-[var(--color-text)]",
        strike && "text-[var(--color-subtle)] line-through",
        className,
      )}
    >
      {formatNaira(kobo)}
    </span>
  );
}
