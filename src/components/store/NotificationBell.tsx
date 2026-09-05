"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check } from "@phosphor-icons/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { relativeTime } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";

export function NotificationBell() {
  const { customer } = useAuth();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on route change and on outside click / Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!customer) return null;

  const preview = items.slice(0, 8);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        className="relative inline-flex size-10 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-muted)_14%,transparent)] hover:text-[var(--color-text)]"
      >
        <Bell className="size-[22px]" weight={unreadCount > 0 ? "fill" : "regular"} />
        {unreadCount > 0 ? (
          <span className="tnum absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-semibold leading-[18px] text-[var(--color-on-accent)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-raise)]">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3.5 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--color-text)]">Notifications</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-[12px] text-[var(--color-accent)] hover:underline"
              >
                <Check className="size-3.5" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[min(28rem,60vh)] overflow-y-auto">
            {preview.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-[13px] text-[var(--color-muted)]">
                Nothing yet. Order updates will show up here.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {preview.map((n) => {
                  const href = n.orderNumber ? `/account/orders/${encodeURIComponent(n.orderNumber)}` : "/account/orders";
                  return (
                    <li key={n.id}>
                      <Link
                        href={href}
                        onClick={() => {
                          if (!n.readAt) void markRead(n.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex gap-2.5 px-3.5 py-3 transition-colors hover:bg-[var(--color-bg)]",
                          !n.readAt && "bg-[color-mix(in_oklab,var(--color-accent)_6%,transparent)]",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            n.readAt ? "bg-transparent" : "bg-[var(--color-accent)]",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-[var(--color-text)]">
                            {n.title}
                            {n.orderNumber ? (
                              <span className="ml-1 font-mono text-[11px] font-normal text-[var(--color-subtle)]">
                                {n.orderNumber}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-[var(--color-muted)]">{n.body}</span>
                          <span className="mt-0.5 block text-[11px] text-[var(--color-subtle)]">
                            {relativeTime(n.createdAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-[var(--color-line)] px-3.5 py-2 text-center">
            <Link
              href="/account/notifications"
              onClick={() => setOpen(false)}
              className="text-[12.5px] text-[var(--color-accent)] hover:underline"
            >
              See all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
