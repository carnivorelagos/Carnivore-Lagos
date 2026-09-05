"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { adminGetPaymentIssues, adminResolvePaymentIssue } from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { cn } from "@/lib/client/cn";
import { formatDateTime } from "@/lib/client/format";
import type { AdminPaymentIssue, PaymentIssueStatus, PaymentIssueType } from "@/lib/client/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { PageHeader, TableWrap, thClass, tdClass, SkeletonRows, EmptyRow } from "@/components/admin/primitives";
import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/feedback";

const PAGE_SIZE = 20;

const FILTERS: { value: PaymentIssueStatus | ""; label: string }[] = [
  { value: "", label: "Open" }, // "" → server defaults to OPEN
  { value: "RESOLVED", label: "Resolved" },
  { value: "IGNORED", label: "Ignored" },
];

const TYPE_LABEL: Record<PaymentIssueType, string> = {
  AMOUNT_MISMATCH: "Amount mismatch",
  ORPHAN_CHARGE: "Orphan charge",
  STUCK_PENDING: "Stuck pending",
  PAID_ORDER_NOT_ADVANCED: "Paid, order not advanced",
};

function IssueRow({ issue, onChanged }: { issue: AdminPaymentIssue; onChanged: () => void }) {
  const [busy, setBusy] = useState<null | "RESOLVED" | "IGNORED">(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (status: "RESOLVED" | "IGNORED") => {
    setBusy(status);
    setErr(null);
    try {
      await adminResolvePaymentIssue(issue.id, status);
      onChanged();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <>
      <tr className="align-top">
        <td className={tdClass}>
          <span className="font-medium text-[var(--color-text)]">{TYPE_LABEL[issue.type]}</span>
          <div className="mt-0.5 font-mono text-[11px] text-[var(--color-subtle)] break-all">
            {issue.reference}
          </div>
        </td>
        <td className={tdClass}>
          {issue.orderNumber ? (
            issue.orderId ? (
              <Link
                href={`/admin/orders/${issue.orderId}`}
                className="tnum font-mono text-[var(--color-text)] hover:text-[var(--color-accent)]"
              >
                {issue.orderNumber}
              </Link>
            ) : (
              <span className="tnum font-mono text-[var(--color-text)]">{issue.orderNumber}</span>
            )
          ) : (
            <span className="text-[var(--color-subtle)]">-</span>
          )}
        </td>
        <td className={cn(tdClass, "text-right whitespace-nowrap")}>
          {issue.expectedKobo != null ? (
            <div>
              <span className="text-[var(--color-subtle)]">exp </span>
              <Money kobo={issue.expectedKobo} size="sm" />
            </div>
          ) : null}
          {issue.observedKobo != null ? (
            <div>
              <span className="text-[var(--color-subtle)]">got </span>
              <Money kobo={issue.observedKobo} size="sm" />
            </div>
          ) : null}
          {issue.expectedKobo == null && issue.observedKobo == null ? (
            <span className="text-[var(--color-subtle)]">-</span>
          ) : null}
        </td>
        <td className={cn(tdClass, "whitespace-nowrap text-[var(--color-muted)]")}>
          {formatDateTime(issue.createdAt)}
        </td>
        <td className={tdClass}>
          {issue.status === "OPEN" ? (
            <div className="flex flex-col gap-1.5">
              <Button size="sm" variant="secondary" loading={busy === "RESOLVED"} onClick={() => act("RESOLVED")}>
                Resolve
              </Button>
              <Button size="sm" variant="ghost" loading={busy === "IGNORED"} onClick={() => act("IGNORED")}>
                Ignore
              </Button>
              {err ? <span className="text-[11px] text-[var(--color-danger)]">{err}</span> : null}
            </div>
          ) : (
            <span className="text-[11px] text-[var(--color-subtle)]">
              {issue.status === "RESOLVED" ? "Resolved" : "Ignored"}
              {issue.resolvedBy ? ` · ${issue.resolvedBy}` : ""}
            </span>
          )}
        </td>
      </tr>
      <tr>
        <td colSpan={5} className="border-b border-[var(--color-line)] px-3 pb-3 text-[12px] text-[var(--color-muted)]">
          {issue.detail}
        </td>
      </tr>
    </>
  );
}

function PaymentsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const statusParam = (params.get("status") as PaymentIssueStatus | null) ?? null;
  const page = Math.max(1, Number(params.get("page") || "1"));

  const { data, status, error, reload } = useAdminData(
    () =>
      adminGetPaymentIssues({
        status: statusParam ?? undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [statusParam, page],
  );

  const setParams = useCallback(
    (next: { status?: string | null; page?: number }) => {
      const qs = new URLSearchParams(params.toString());
      if ("status" in next) {
        if (next.status) qs.set("status", next.status);
        else qs.delete("status");
        qs.delete("page");
      }
      if (next.page) qs.set("page", String(next.page));
      router.replace(`${pathname}?${qs.toString()}`);
    },
    [params, pathname, router],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Anomalies that need a human: amount mismatches, orphan charges, stuck or paid-but-unadvanced orders."
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const active = (statusParam ?? "") === f.value;
          return (
            <button
              key={f.value || "open"}
              type="button"
              onClick={() => setParams({ status: f.value || null })}
              className={cn(
                "h-8 rounded-md px-3 text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-line-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {f.label}
              {f.value === "" && data && data.openCount > 0 ? ` (${data.openCount})` : ""}
            </button>
          );
        })}
      </div>

      {status === "error" ? (
        <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Issue</th>
                <th className={thClass}>Order</th>
                <th className={cn(thClass, "text-right")}>Amount</th>
                <th className={thClass}>Detected</th>
                <th className={thClass}>Action</th>
              </tr>
            </thead>
            <tbody>
              {status === "loading" ? (
                <SkeletonRows rows={6} cols={5} />
              ) : data!.items.length === 0 ? (
                <EmptyRow colSpan={5}>
                  {(statusParam ?? "OPEN") === "OPEN"
                    ? "No open payment issues. 🎉"
                    : "Nothing here."}
                </EmptyRow>
              ) : (
                data!.items.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} onChanged={() => reload()} />
                ))
              )}
            </tbody>
          </TableWrap>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setParams({ page: page - 1 })}
              >
                Previous
              </Button>
              <span className="tnum text-[12px] text-[var(--color-subtle)]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setParams({ page: page + 1 })}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsTable />
    </Suspense>
  );
}
