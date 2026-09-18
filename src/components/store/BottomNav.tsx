"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClockCounterClockwise, ForkKnife, ShoppingBag } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";
import { useCart } from "@/components/providers/CartProvider";
import { useCartSheet } from "@/components/store/CartSheet";

/**
 * Mobile primary navigation (Section 6). Hidden from `sm` up, where the
 * header nav takes over. Thumb-reachable, generous hit targets.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { count, hydrated } = useCart();
  const cartSheet = useCartSheet();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  // The home page (/) is the menu, so the Menu tab is lit on both.
  const menuActive = pathname === "/" || isActive("/menu");

  const itemClass = (active: boolean) =>
    cn(
      "relative flex flex-1 flex-col items-center justify-center gap-1 pt-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors",
      "before:absolute before:inset-x-5 before:top-0 before:h-[2px] before:bg-[var(--color-accent)] before:transition-opacity before:duration-200",
      active
        ? "text-[var(--color-text)] before:opacity-100"
        : "text-[var(--color-subtle)] before:opacity-0",
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_88%,transparent)] backdrop-blur-md sm:hidden"
    >
      <Link href="/menu" className={itemClass(menuActive)}>
        <ForkKnife weight={menuActive ? "fill" : "regular"} className="size-[22px]" />
        Menu
      </Link>
      <button type="button" onClick={cartSheet.open} className={itemClass(false)}>
        <span className="relative">
          <ShoppingBag className="size-[22px]" />
          {hydrated && count > 0 ? (
            <span className="tnum absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-semibold leading-4 text-[var(--color-on-accent)]">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </span>
        Cart
      </button>
      <Link href="/history" className={itemClass(isActive("/history"))}>
        <ClockCounterClockwise
          weight={isActive("/history") ? "fill" : "regular"}
          className="size-[22px]"
        />
        Orders
      </Link>
    </nav>
  );
}
