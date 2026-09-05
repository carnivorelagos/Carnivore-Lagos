"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretRight, Receipt } from "@phosphor-icons/react";
import { getMyOrders } from "@/lib/client/endpoints";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { errorMessage } from "@/lib/client/errors";
import { formatDate, FULFILLMENT_LABEL } from "@/lib/client/format";
import { RequireAuth } from "@/components/store/RequireAuth";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";

const LIMIT = 10;

function OrdersInner() {
  const [page, setPage] = useState(1);
  const { data, status, error, reload } = useAsyncData(
    () => getMyOrders({ page, limit: LIMIT }),
    [page],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <div className="shell gutter max-w-2xl py-8 sm:py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl sm:text-4xl">Your orders</h1>
        <Link href="/account" className="text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
          Account
        </Link>
      </div>

      <div className="mt-8">
        {status === "loading" ? (
          <ul className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="rounded-lg border border-[var(--color-line)] p-4">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </li>
            ))}
          </ul>
        ) : status === "error" ? (
          <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No orders yet"
            description="When you place your first order, it'll show up here with its live status."
            action={
              <Link href="/menu" className={buttonVariants({ variant: "primary" })}>
                Start your first order
              </Link>
            }
          />
        ) : (
          <>
            <ul className="space-y-3">
              {data!.items.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/account/orders/${o.orderNumber}`}
                    className="flex items-center gap-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-line-strong)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="tnum font-mono text-sm text-[var(--color-text)]">
                          {o.orderNumber}
                        </span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <p className="mt-1 text-[12.5px] text-[var(--color-subtle)]">
                        {formatDate(o.createdAt)} · {FULFILLMENT_LABEL[o.fulfillmentType]}
                      </p>
                    </div>
                    <Money kobo={o.totalKobo} size="sm" />
                    <CaretRight className="size-4 text-[var(--color-subtle)]" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="tnum text-[12.5px] text-[var(--color-subtle)]">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function AccountOrdersPage() {
  return (
    <RequireAuth>
      <OrdersInner />
    </RequireAuth>
  );
}
