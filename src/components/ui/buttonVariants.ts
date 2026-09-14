import { cn } from "@/lib/client/cn";

/**
 * The button's class recipe, split out of Button.tsx so it stays a plain
 * (non-"use client") module. Next 16 refuses to let a Server Component
 * call a function exported from a client module — and `buttonVariants()`
 * is called directly from Server Components (not-found.tsx, the home
 * page) to style `<Link>`s. Client code can import it from either file.
 */

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
export type Size = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap " +
  "rounded-[var(--radius-md)] font-semibold tracking-[0.005em] " +
  "transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-200 ease-[var(--ease-out-quint)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] " +
  "disabled:pointer-events-none disabled:opacity-55";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-[0_1px_0_rgba(255,255,255,0.09)_inset] " +
    "hover:bg-[var(--color-accent-hover)] hover:-translate-y-px hover:shadow-[var(--shadow-ember)] " +
    "active:translate-y-0 active:shadow-[0_1px_0_rgba(255,255,255,0.09)_inset]",
  secondary:
    "border border-[var(--color-line-strong)] bg-transparent text-[var(--color-text)] " +
    "hover:border-[var(--color-accent)] hover:bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] " +
    "active:translate-y-px",
  ghost:
    "bg-transparent text-[var(--color-text)] hover:bg-[color-mix(in_oklab,var(--color-muted)_14%,transparent)] " +
    "active:translate-y-px",
  quiet:
    "bg-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]",
  danger:
    "bg-[var(--color-danger)] text-white hover:brightness-95 hover:-translate-y-px active:translate-y-0",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[14px] uppercase tracking-[0.08em]",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}
