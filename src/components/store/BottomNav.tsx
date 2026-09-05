"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ForkKnife, House, ShoppingBag, User } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCartSheet } from "@/components/store/CartSheet";

/**
 * Mobile primary navigation (Section 6). Hidden from `sm` up, where the
 * header nav takes over. Thumb-reachable, generous hit targets.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { count, hydrated } = useCart();
  const { customer } = useAuth();
  const cartSheet = useCartSheet();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[11px] font-medium transition-colors",
      active ? "text-[var(--color-text)]" : "text-[var(--color-subtle)]",
    );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_92%,transparent)] backdrop-blur-md sm:hidden"
    >
      <Link href="/" className={itemClass(isActive("/"))}>
        <House weight={isActive("/") ? "fill" : "regular"} className="size-[22px]" />
        Home
      </Link>
      <Link href="/menu" className={itemClass(isActive("/menu"))}>
        <ForkKnife weight={isActive("/menu") ? "fill" : "regular"} className="size-[22px]" />
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
      <Link
        href={customer ? "/account" : "/login"}
        className={itemClass(isActive("/account") || isActive("/login"))}
      >
        <User
          weight={isActive("/account") || isActive("/login") ? "fill" : "regular"}
          className="size-[22px]"
        />
        Account
      </Link>
    </nav>
  );
}
