"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ForkKnife, ShoppingBagOpen } from "@phosphor-icons/react";
import { useCart } from "@/components/providers/CartProvider";
import { Sheet } from "@/components/ui/Overlay";
import { Button, buttonVariants } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/feedback";
import { formatNaira } from "@/lib/client/format";

type CartSheetValue = { open: () => void; close: () => void; toggle: () => void };
const CartSheetContext = createContext<CartSheetValue | null>(null);

export function useCartSheet(): CartSheetValue {
  const ctx = useContext(CartSheetContext);
  if (!ctx) throw new Error("useCartSheet must be used inside <CartSheetProvider>");
  return ctx;
}

export function CartSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { items, subtotalKobo, setQuantity, remove, count } = useCart();

  const value = useMemo<CartSheetValue>(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
    }),
    [],
  );

  const goToCheckout = useCallback(() => {
    setOpen(false);
    router.push("/checkout");
  }, [router]);

  return (
    <CartSheetContext.Provider value={value}>
      {children}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Your cart"
        description={count > 0 ? `${count} item${count === 1 ? "" : "s"}` : undefined}
        footer={
          items.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-[var(--color-muted)]">Subtotal</span>
                <Money kobo={subtotalKobo} size="lg" />
              </div>
              <p className="text-[12px] text-[var(--color-subtle)]">
                Delivery fee and final total are confirmed at checkout.
              </p>
              <Button fullWidth size="lg" onClick={goToCheckout}>
                Checkout · {formatNaira(subtotalKobo)}
              </Button>
            </div>
          ) : null
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBagOpen}
            title="Your cart is empty"
            description="Add something from the grill to get started."
            action={
              <Link
                href="/menu"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                <ForkKnife className="size-4" /> Browse menu
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-3 py-3.5 first:pt-0">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-[var(--color-surface)]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-[var(--color-subtle)]">
                      <ForkKnife className="size-5" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug text-[var(--color-text)]">
                      {item.name}
                    </p>
                    <Money kobo={item.priceKobo * item.quantity} size="sm" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      min={1}
                      max={50}
                      removable
                      onRemove={() => remove(item.productId)}
                      onChange={(q) => setQuantity(item.productId, q)}
                      ariaLabel={`Quantity of ${item.name}`}
                    />
                    <span className="text-[12px] text-[var(--color-subtle)]">
                      {formatNaira(item.priceKobo)} each
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </CartSheetContext.Provider>
  );
}
