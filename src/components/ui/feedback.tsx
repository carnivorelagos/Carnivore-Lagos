import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-2 border-[var(--color-line-strong)] border-t-[var(--color-accent)]",
        className,
      )}
    />
  );
}

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <span className={cn("skeleton block", className)} style={style} aria-hidden />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{ width: i === lines - 1 ? "62%" : "100%" }}
        />
      ))}
    </span>
  );
}

export function EmptyState({
  icon: IconEl,
  title,
  description,
  action,
  className,
}: {
  icon?: Icon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {IconEl ? (
        <span className="grid size-12 place-items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]">
          <IconEl className="size-6" aria-hidden />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-display text-lg text-[var(--color-text)]">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Please try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="font-display text-lg text-[var(--color-text)]">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-line-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-muted)_12%,transparent)]"
        >
          <ArrowClockwise className="size-4" aria-hidden />
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Standard wrapper for a data-driven region: shows a skeleton while
 * loading, an error state (with retry) on failure, an empty state when
 * there's nothing, else the children.
 */
export function PageState<T>({
  status,
  error,
  isEmpty,
  onRetry,
  skeleton,
  empty,
  children,
}: {
  status: "loading" | "error" | "ready";
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  skeleton: React.ReactNode;
  empty?: React.ReactNode;
  children: (value?: T) => React.ReactNode;
}) {
  if (status === "loading") return <>{skeleton}</>;
  if (status === "error") {
    return (
      <ErrorState
        description={
          error instanceof Error && error.message
            ? error.message
            : "We couldn't load this. Please try again."
        }
        onRetry={onRetry}
      />
    );
  }
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children()}</>;
}
