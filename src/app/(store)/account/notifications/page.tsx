"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Check } from "@phosphor-icons/react";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/client/endpoints";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { errorMessage } from "@/lib/client/errors";
import { relativeTime } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";
import { RequireAuth } from "@/components/store/RequireAuth";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { PushToggle } from "@/components/store/NotificationSettings";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";

const LIMIT = 20;

function NotificationsInner() {
  const [page, setPage] = useState(1);
  const { refresh: refreshBadge } = useNotifications();
  const { data, status, error, reload } = useAsyncData(
    () => getMyNotifications({ page, limit: LIMIT }),
    [page],
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  const onMarkAll = async () => {
    await markAllNotificationsRead().catch(() => undefined);
    await reload();
    await refreshBadge();
  };

  const onOpen = async (id: string, read: boolean) => {
    if (read) return;
    await markNotificationRead(id).catch(() => undefined);
    await refreshBadge();
  };

  return (
    <div className="shell gutter max-w-2xl py-8 sm:py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">Notifications</h1>
        <Link href="/account" className="text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)]">
          Account
        </Link>
      </div>

      <div className="mt-6">
        <PushToggle />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-[13px] text-[var(--color-muted)]">
          {data ? `${data.total} total · ${data.unreadCount} unread` : ""}
        </p>
        {data && data.unreadCount > 0 ? (
          <Button size="sm" variant="secondary" onClick={() => void onMarkAll()}>
            <Check className="size-4" aria-hidden /> Mark all read
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        {status === "loading" ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="rounded-lg border border-[var(--color-line)] p-4">
                <Skeleton className="mb-2 h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </li>
            ))}
          </ul>
        ) : status === "error" ? (
          <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Updates about your orders — confirmed, being prepared, ready, on the way — will appear here."
            action={
              <Link href="/menu" className={buttonVariants({ variant: "primary" })}>
                Browse the menu
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {data!.items.map((n) => {
              const href = n.orderNumber
                ? `/account/orders/${encodeURIComponent(n.orderNumber)}`
                : "/account/orders";
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    onClick={() => void onOpen(n.id, Boolean(n.readAt))}
                    className={cn(
                      "flex gap-3 rounded-lg border border-[var(--color-line)] p-4 transition-colors hover:border-[var(--color-line-strong)]",
                      !n.readAt && "bg-[color-mix(in_oklab,var(--color-accent)_6%,transparent)]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        n.readAt ? "bg-[var(--color-line-strong)]" : "bg-[var(--color-accent)]",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        {n.title}
                        {n.orderNumber ? (
                          <span className="ml-1.5 font-mono text-[11px] font-normal text-[var(--color-subtle)]">
                            {n.orderNumber}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{n.body}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-subtle)]">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

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
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsInner />
    </RequireAuth>
  );
}
