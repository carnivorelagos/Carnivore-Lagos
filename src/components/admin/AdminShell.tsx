"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GearSix,
  List,
  Receipt,
  SignOut,
  SquaresFour,
  Tag,
  Warning,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";
import { useAdminAuth } from "@/components/providers/AdminAuthProvider";
import { Spinner } from "@/components/ui/feedback";
import { AdminOrderAlerts } from "@/components/admin/AdminOrderAlerts";

const NAV = [
  { href: "/admin", label: "Overview", icon: SquaresFour, exact: true },
  { href: "/admin/orders", label: "Orders", icon: Receipt },
  { href: "/admin/payments", label: "Payments", icon: Warning },
  { href: "/admin/products", label: "Products", icon: Tag },
  { href: "/admin/categories", label: "Categories", icon: List },
  { href: "/admin/settings", label: "Settings", icon: GearSix },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-[var(--radius-md)] py-2 pl-4 pr-3 text-[13px] font-semibold transition-colors",
              "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-[var(--color-accent)] before:transition-opacity",
              active
                ? "bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] text-[var(--color-accent)] before:opacity-100"
                : "text-[var(--color-muted)] before:opacity-0 hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
            )}
          >
            <Icon className="size-[18px]" weight={active ? "fill" : "regular"} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, ready, logout } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Login route: no chrome, no guard.
  if (pathname === "/admin/login") return <>{children}</>;

  if (!ready) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!admin) {
    // AdminAuthProvider is redirecting to /admin/login.
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh]">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-4 lg:flex">
        <div className="px-4 pb-5 pt-1">
          <p className="flex items-center gap-1.5 font-display text-[16px] uppercase leading-none tracking-[0.01em] text-[var(--color-text)]">
            Carnivore
            <span aria-hidden className="inline-block size-1.5 bg-[var(--color-accent)]" />
            Lagos
          </p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-subtle)]">
            Admin console
          </p>
        </div>
        <NavLinks />
        <div className="mt-auto border-t border-[var(--color-line)] px-3 pt-3">
          <div className="mb-2.5">
            <AdminOrderAlerts />
          </div>
          <p className="truncate text-[12px] text-[var(--color-muted)]">{admin.email}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-danger)]"
          >
            <SignOut className="size-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] p-3">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="font-display text-[15px] uppercase tracking-[0.04em]">Admin</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close">
                <X className="size-5 text-[var(--color-muted)]" />
              </button>
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
            <div className="mt-auto px-3 pt-3">
              <AdminOrderAlerts compact />
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[var(--color-muted)] hover:text-[var(--color-danger)]"
            >
              <SignOut className="size-4" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-bg)]"
          >
            <List className="size-5" />
          </button>
          <span className="flex items-center gap-1.5 font-display text-[15px] uppercase tracking-[0.03em]">
            Carnivore
            <span aria-hidden className="inline-block size-1.5 bg-[var(--color-accent)]" />
            Lagos
          </span>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
