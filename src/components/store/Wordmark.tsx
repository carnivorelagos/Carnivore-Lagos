import Link from "next/link";
import { cn } from "@/lib/client/cn";
import { BRAND } from "@/lib/client/brand";

/**
 * Text wordmark (no logo asset yet). Anton, uppercase, locked tight.
 * Swap for the real logo when it arrives.
 */
export function Wordmark({
  className,
  size = "md",
  href = "/",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  const sizeClass = {
    sm: "text-[15px]",
    md: "text-[18px]",
    lg: "text-[28px]",
  }[size];

  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-[0.28em] font-display uppercase leading-none tracking-[0.01em] text-[var(--color-text)]",
        sizeClass,
        className,
      )}
    >
      <span>Carnivore</span>
      <span className="text-[var(--color-muted)]">Lagos</span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label={`${BRAND.name} - home`} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
