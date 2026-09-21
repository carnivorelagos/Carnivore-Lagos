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
  tagline = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string | null;
  /** Show the brand phrase ("...from farm to table") beside the logo, in red. */
  tagline?: boolean;
}) {
  const sizeClass = {
    sm: "text-[26px]",
    md: "text-[34px]",
    lg: "text-[52px]",
  }[size];

  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-[0.3em] font-logo uppercase leading-none tracking-[0.025em] text-[var(--color-text)]",
        // Drazel only ships one light weight — a thin same-colour outline
        // thickens the strokes evenly at every size.
        "[-webkit-text-stroke:0.045em_currentColor]",
        sizeClass,
        className,
      )}
    >
      <span>Carnivore</span>
      <span>Lagos</span>
    </span>
  );

  const mark = href ? (
    <Link href={href} aria-label={`${BRAND.name} - home`} className="inline-flex items-center">
      {inner}
    </Link>
  ) : (
    inner
  );

  if (!tagline) return mark;

  // Logo, then the phrase on its side. The logo never shrinks and the phrase
  // always stays on one straight line (11px medium fits beside the logo
  // with room to spare from ~360px). Below ~350px there's no honest room
  // for it next to the logo and cart, so it drops out rather than wrap
  // or crowd the cart icon.
  return (
    <span className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <span className="shrink-0">{mark}</span>
      <span
        // The brand red with a whisper of white (#e83e32): the pure accent
        // (#e4231d) is only ~4.0-4.3:1 against the near-black ground, a
        // touch under AA for small text. 7% white gets 4.8:1 on the header
        // and 4.5:1 on the footer while still reading as the brand red.
        className="min-w-0 whitespace-nowrap text-[11px] font-medium leading-none tracking-[0.01em] text-[color-mix(in_oklab,var(--color-accent)_93%,white)] max-[349px]:hidden sm:text-[12px]"
      >
        {BRAND.promise}
      </span>
    </span>
  );
}
