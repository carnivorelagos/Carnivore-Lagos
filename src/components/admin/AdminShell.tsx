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
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
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
        <div className="px-3 pb-4">
          <p className="font-display text-[15px] font-medium text-[var(--color-text)]">
            Carnivore Lagos
          </p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-subtle)]">
            Admin
          </p>
        </div>
        <NavLinks />
        <div className="mt-auto border-t border-[var(--color-line)] px-3 pt-3">
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
              <span className="font-display text-sm font-medium">Admin</span>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close">
                <X className="size-5 text-[var(--color-muted)]" />
              </button>
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-auto inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[var(--color-muted)] hover:text-[var(--color-danger)]"
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
          <span className="font-display text-sm font-medium">Carnivore Lagos Admin</span>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
