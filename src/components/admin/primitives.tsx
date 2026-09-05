import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/client/cn";

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {backLabel}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-text)]">{title}</h1>
          {description ? (
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "form";
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-raise)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
      <table className="w-full min-w-[40rem] border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export const thClass =
  "border-b border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-subtle)]";

export const tdClass = "border-b border-[var(--color-line)] px-3 py-2.5 align-middle";

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className={tdClass}>
              <span className="skeleton block h-3.5 w-full max-w-[8rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-16 text-center text-[13px] text-[var(--color-muted)]">
        {children}
      </td>
    </tr>
  );
}
