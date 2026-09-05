"use client";

import Link from "next/link";
import { Warning } from "@phosphor-icons/react";
import { adminGetOrders, adminGetPaymentIssues } from "@/lib/client/endpoints";
import { errorMessage } from "@/lib/client/errors";
import { formatDateTime, FULFILLMENT_LABEL, ORDER_STATUS_LABEL } from "@/lib/client/format";
import type { OrderStatus } from "@/lib/client/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { PageHeader, TableWrap, thClass, tdClass, SkeletonRows, EmptyRow } from "@/components/admin/primitives";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { ErrorState } from "@/components/ui/feedback";

const TILE_STATUSES: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "PREPARING", "READY"];

function StatTile({ status }: { status: OrderStatus }) {
  const { data, status: s } = useAdminData(
    () => adminGetOrders({ status, page: 1, limit: 1 }),
    [status],
  );
  return (
    <Link
      href={`/admin/orders?status=${status}`}
      className="rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-raise)] transition-colors hover:border-line-strong"
    >
      <p className="text-[12px] font-medium text-muted">{ORDER_STATUS_LABEL[status]}</p>
      <p className="tnum mt-1 font-mono text-2xl text-text">
        {s === "loading" ? <span className="skeleton inline-block h-6 w-8 align-middle" /> : (data?.total ?? 0)}
      </p>
    </Link>
  );
}

function PaymentIssuesBanner() {
  const { data } = useAdminData(() => adminGetPaymentIssues({ page: 1, limit: 1 }), []);
  if (!data || data.openCount === 0) return null;
  return (
    <Link
      href="/admin/payments"
      className="mb-5 flex items-center gap-2.5 rounded-lg border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)] px-4 py-3 text-[13px] text-[var(--color-text)] transition-colors hover:border-[var(--color-danger)]"
    >
      <Warning className="size-4 shrink-0 text-[var(--color-danger)]" weight="fill" aria-hidden />
      <span>
        {data.openCount} open payment issue{data.openCount === 1 ? "" : "s"} need review.
      </span>
    </Link>
  );
}

export default function AdminOverviewPage() {
  const recent = useAdminData(() => adminGetOrders({ page: 1, limit: 8 }), []);

  return (
    <>
      <PageHeader title="Overview" description="Today's order flow at a glance." />

      <PaymentIssuesBanner />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILE_STATUSES.map((s) => (
          <StatTile key={s} status={s} />
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-text">Recent orders</h2>
          <Link href="/admin/orders" className="text-[12.5px] text-accent hover:underline">
            All orders
          </Link>
        </div>

        {recent.status === "error" ? (
          <ErrorState description={errorMessage(recent.error)} onRetry={() => recent.reload()} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Order</th>
                <th className={thClass}>Customer</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Total</th>
                <th className={thClass}>Placed</th>
              </tr>
            </thead>
            <tbody>
              {recent.status === "loading" ? (
                <SkeletonRows rows={6} cols={5} />
              ) : recent.data!.items.length === 0 ? (
                <EmptyRow colSpan={5}>No orders yet.</EmptyRow>
              ) : (
                recent.data!.items.map((o) => (
                  <tr key={o.id} className="hover:bg-bg">
                    <td className={tdClass}>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="tnum font-mono text-text hover:text-accent"
                      >
                        {o.orderNumber}
                      </Link>
                      <div className="text-[11px] text-subtle">
                        {FULFILLMENT_LABEL[o.fulfillmentType]}
                      </div>
                    </td>
                    <td className={`${tdClass} text-text`}>{o.customerName}</td>
                    <td className={tdClass}>
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Money kobo={o.totalKobo} size="sm" />
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>
                      {formatDateTime(o.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        )}
      </div>
    </>
  );
}
