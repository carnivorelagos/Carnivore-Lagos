"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react";
import { adminBulkOrderStatus, adminGetOrders } from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { cn } from "@/lib/client/cn";
import { ORDER_STATUSES } from "@/lib/client/types";
import type { OrderStatus } from "@/lib/client/types";
import { formatDateTime, ORDER_STATUS_LABEL, FULFILLMENT_LABEL } from "@/lib/client/format";
import { allowedNextStatuses, TRANSITION_VERB } from "@/lib/client/orderFlow";
import { useAdminData } from "@/components/admin/useAdminData";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, TableWrap, thClass, tdClass, SkeletonRows, EmptyRow } from "@/components/admin/primitives";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/feedback";

const PAGE_SIZE = 20;

type Row = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: "PICKUP" | "DELIVERY";
  customerName: string;
  totalKobo: number;
  createdAt: string;
  payment: { status: "PENDING" | "SUCCESS" | "FAILED" } | null;
};

/** The single forward step for a row, if there's exactly one obvious one. */
function forwardStep(row: Row): OrderStatus | null {
  return allowedNextStatuses(row.status, row.fulfillmentType).find((s) => s !== "CANCELLED") ?? null;
}

function OrdersTable() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();

  const statusParam = params.get("status") as OrderStatus | null;
  const page = Math.max(1, Number(params.get("page") || "1"));

  const { data, status, error, reload } = useAdminData(
    () => adminGetOrders({ status: statusParam ?? undefined, page, limit: PAGE_SIZE }),
    [statusParam, page],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Live-refresh when a "new paid order" Web Push lands while this board
  // is open (the service worker relays it — see public/sw.js).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "push") reload();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [reload]);

  const rows: Row[] = useMemo(() => (data?.items as Row[]) ?? [], [data]);

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
      setSelected(new Set());
    },
    [params, pathname, router],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectableIds = useMemo(() => rows.filter((r) => forwardStep(r)).map((r) => r.id), [rows]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const runBulk = async (target?: OrderStatus) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await adminBulkOrderStatus(ids, target);
      if (res.failed === 0) {
        toast({ tone: "success", title: `${res.moved} order${res.moved === 1 ? "" : "s"} advanced` });
      } else {
        toast({
          tone: res.moved > 0 ? "warning" : "danger",
          title: `${res.moved} advanced, ${res.failed} skipped`,
          description: res.results.find((r) => !r.ok)?.error,
        });
      }
      setSelected(new Set());
      await reload(true);
    } catch (e) {
      toast({ tone: "danger", title: "Bulk update failed", description: errorMessage(e) });
    } finally {
      setBulkBusy(false);
    }
  };

  const advanceOne = async (row: Row) => {
    const to = forwardStep(row);
    if (!to) return;
    setBulkBusy(true);
    try {
      const res = await adminBulkOrderStatus([row.id], to);
      const r = res.results[0];
      if (r?.ok) toast({ tone: "success", title: `${row.orderNumber} → ${ORDER_STATUS_LABEL[to]}` });
      else toast({ tone: "warning", title: r?.error ?? "Couldn't advance" });
      await reload(true);
    } catch (e) {
      toast({ tone: "danger", title: "Update failed", description: errorMessage(e) });
    } finally {
      setBulkBusy(false);
    }
  };

  // Bulk quick-targets: statuses reachable from *every* selected row.
  const commonTargets = useMemo(() => {
    const sel = rows.filter((r) => selected.has(r.id));
    if (sel.length === 0) return [] as OrderStatus[];
    let common: OrderStatus[] | null = null;
    for (const r of sel) {
      const next: OrderStatus[] = allowedNextStatuses(r.status, r.fulfillmentType).filter(
        (s) => s !== "CANCELLED",
      );
      common = common === null ? next : common.filter((s) => next.includes(s));
    }
    return common ?? [];
  }, [rows, selected]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Orders"
        description={data ? `${data.total} order${data.total === 1 ? "" : "s"}` : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="status-filter" className="text-[12px] font-medium text-[var(--color-muted)]">
          Status
        </label>
        <select
          id="status-filter"
          value={statusParam ?? ""}
          onChange={(e) => setParams({ status: e.target.value || null })}
          className="h-9 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text)]"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2">
          <span className="text-[12.5px] font-medium text-[var(--color-text)]">{selected.size} selected</span>
          <Button size="sm" variant="primary" loading={bulkBusy} onClick={() => void runBulk()}>
            Advance one step
          </Button>
          {commonTargets.map((t) => (
            <Button key={t} size="sm" variant="secondary" loading={bulkBusy} onClick={() => void runBulk(t)}>
              {TRANSITION_VERB[t]}
            </Button>
          ))}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[12px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Clear
          </button>
        </div>
      ) : null}

      {status === "error" ? (
        <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th className={cn(thClass, "w-9")}>
                  <input
                    type="checkbox"
                    aria-label="Select all advanceable"
                    checked={allSelected}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(selectableIds) : new Set())
                    }
                  />
                </th>
                <th className={thClass}>Order</th>
                <th className={thClass}>Customer</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Payment</th>
                <th className={cn(thClass, "text-right")}>Total</th>
                <th className={thClass}>Placed</th>
                <th className={cn(thClass, "text-right")}>Advance</th>
              </tr>
            </thead>
            <tbody>
              {status === "loading" ? (
                <SkeletonRows rows={8} cols={8} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={8}>
                  {statusParam
                    ? `No ${ORDER_STATUS_LABEL[statusParam].toLowerCase()} orders.`
                    : "No orders yet."}
                </EmptyRow>
              ) : (
                rows.map((o) => {
                  const step = forwardStep(o);
                  return (
                    <tr key={o.id} className="hover:bg-[var(--color-bg)]">
                      <td className={tdClass}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${o.orderNumber}`}
                          disabled={!step}
                          checked={selected.has(o.id)}
                          onChange={() => toggle(o.id)}
                        />
                      </td>
                      <td className={tdClass}>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="tnum font-mono text-[var(--color-text)] hover:text-[var(--color-accent)]"
                        >
                          {o.orderNumber}
                        </Link>
                        <div className="text-[11px] text-[var(--color-subtle)]">
                          {FULFILLMENT_LABEL[o.fulfillmentType]}
                        </div>
                      </td>
                      <td className={cn(tdClass, "text-[var(--color-text)]")}>{o.customerName}</td>
                      <td className={tdClass}>
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className={tdClass}>
                        {o.payment ? (
                          <PaymentStatusBadge status={o.payment.status} />
                        ) : (
                          <span className="text-[var(--color-subtle)]">-</span>
                        )}
                      </td>
                      <td className={cn(tdClass, "text-right")}>
                        <Money kobo={o.totalKobo} size="sm" />
                      </td>
                      <td className={cn(tdClass, "whitespace-nowrap text-[var(--color-muted)]")}>
                        {formatDateTime(o.createdAt)}
                      </td>
                      <td className={cn(tdClass, "text-right")}>
                        {step ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={bulkBusy}
                            onClick={() => void advanceOne(o)}
                          >
                            {ORDER_STATUS_LABEL[step]}
                            <CaretRight className="size-3.5" aria-hidden />
                          </Button>
                        ) : (
                          <span className="text-[11px] text-[var(--color-subtle)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
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

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersTable />
    </Suspense>
  );
}
