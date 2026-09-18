import Link from "next/link";
import { cn } from "@/lib/client/cn";
import { BRAND } from "@/lib/client/brand";

/**
 * Text wordmark (no logo asset yet). Drazel brush face (--font-logo),
 * uppercase. Swap for the real logo when it arrives. Drazel is narrower and
 * lighter than the display face, so the sizes run larger than they did in
 * Anton to keep the same presence.
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
    sm: "text-[22px]",
    md: "text-[27px]",
    lg: "text-[42px]",
  }[size];

  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-[0.3em] font-logo uppercase leading-none tracking-[0.025em] text-[var(--color-text)]",
        // Drazel only ships one light weight — a thin same-colour outline
        // thickens the strokes evenly at every size (0.035em ~ +1px at 27px).
        "[-webkit-text-stroke:0.035em_currentColor]",
        sizeClass,
        className,
      )}
    >
      <span>Carnivore</span>
      <span>Lagos</span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label={`${BRAND.name} - home`} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
