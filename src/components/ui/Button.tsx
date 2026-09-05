import { forwardRef } from "react";
import { cn } from "@/lib/client/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
  "transition-[transform,background-color,border-color,color,opacity] duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-55";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] " +
    "shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]",
  secondary:
    "border border-[var(--color-line-strong)] bg-transparent text-[var(--color-text)] " +
    "hover:bg-[color-mix(in_oklab,var(--color-muted)_12%,transparent)] hover:border-[var(--color-muted)]",
  ghost:
    "bg-transparent text-[var(--color-text)] hover:bg-[color-mix(in_oklab,var(--color-muted)_14%,transparent)]",
  quiet:
    "bg-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]",
  danger:
    "bg-[var(--color-danger)] text-white hover:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
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

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth,
    loading = false,
    icon,
    iconRight,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="absolute size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      <span
        className={cn(
          "inline-flex items-center gap-2",
          loading && "opacity-0",
        )}
      >
        {icon ? <span className="-ml-0.5 shrink-0">{icon}</span> : null}
        {children}
        {iconRight ? <span className="-mr-0.5 shrink-0">{iconRight}</span> : null}
      </span>
    </button>
  );
});
