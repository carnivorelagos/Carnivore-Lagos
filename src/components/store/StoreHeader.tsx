"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClockCounterClockwise, ShoppingBag } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";
import { useCart } from "@/components/providers/CartProvider";
import { useCartSheet } from "@/components/store/CartSheet";
import { Wordmark } from "@/components/store/Wordmark";

export function StoreHeader() {
  const pathname = usePathname();
  const { count, hydrated } = useCart();
  const cartSheet = useCartSheet();

  // `alsoOnHome`: the home page (/) IS the menu, so the Menu link is lit there too.
  const navLink = (href: string, label: string, alsoOnHome = false) => {
    const active =
      pathname === href ||
      (href !== "/" && pathname.startsWith(href)) ||
      (alsoOnHome && pathname === "/");
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative py-1 text-[13px] font-semibold uppercase tracking-[0.11em] transition-colors",
          "after:absolute after:inset-x-0 after:-bottom-1 after:h-[2px] after:origin-left after:bg-[var(--color-accent)] after:transition-transform after:duration-200 after:ease-[var(--ease-out-quint)]",
          active
            ? "text-[var(--color-text)] after:scale-x-100"
            : "text-[var(--color-muted)] after:scale-x-0 hover:text-[var(--color-text)] hover:after:scale-x-100",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_82%,transparent)] backdrop-blur-md">
      <div className="shell gutter flex h-14 items-center justify-between gap-4 sm:h-16">
        <div className="flex min-w-0 items-center gap-8">
          <Wordmark size="md" tagline />
          <nav className="hidden items-center gap-7 sm:flex">
            {navLink("/menu", "Menu", true)}
            {navLink("/history", "Orders")}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/history"
            aria-label="Your orders"
            className="hidden size-10 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-muted)_14%,transparent)] hover:text-[var(--color-text)] sm:inline-flex"
          >
            <ClockCounterClockwise className="size-[22px]" />
          </Link>

          <button
            type="button"
            onClick={cartSheet.open}
            aria-label={`Open cart${count > 0 ? `, ${count} items` : ""}`}
            className="relative inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-[var(--color-text)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-muted)_14%,transparent)]"
          >
            <ShoppingBag className="size-[22px]" />
            {hydrated && count > 0 ? (
              <span className="tnum grid min-w-5 place-items-center rounded-full bg-[var(--color-accent)] px-1 text-[11px] font-semibold text-[var(--color-on-accent)]">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}
