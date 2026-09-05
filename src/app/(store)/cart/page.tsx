"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ForkKnife, ShoppingBagOpen } from "@phosphor-icons/react";
import { useCart } from "@/components/providers/CartProvider";
import { Button, buttonVariants } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/feedback";
import { formatNaira } from "@/lib/client/format";

export default function CartPage() {
  const { items, subtotalKobo, count, setQuantity, remove, hydrated } = useCart();
  const router = useRouter();

  if (hydrated && items.length === 0) {
    return (
      <div className="shell gutter py-16">
        <EmptyState
          icon={ShoppingBagOpen}
          title="Your cart is empty"
          description="Once you add something from the grill, it'll show up here."
          action={
            <Link href="/menu" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Browse menu
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="shell gutter py-6 sm:py-10">
      <h1 className="mb-6 font-display text-3xl sm:text-4xl">
        Your cart{" "}
        {hydrated && count > 0 ? (
          <span className="text-[var(--color-subtle)]">
            ({count} item{count === 1 ? "" : "s"})
          </span>
        ) : null}
      </h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
        <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {items.map((item) => (
            <li key={item.productId} className="flex gap-4 py-4">
              <Link
                href={`/product/${item.productId}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-md bg-[var(--color-surface)] sm:size-24"
              >
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt="" fill sizes="96px" className="object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-[var(--color-subtle)]">
                    <ForkKnife className="size-6" aria-hidden />
                  </span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/product/${item.productId}`}
                      className="text-sm font-medium leading-snug hover:text-[var(--color-text)]"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-[var(--color-subtle)]">
                      {formatNaira(item.priceKobo)} each
                    </p>
                  </div>
                  <Money kobo={item.priceKobo * item.quantity} />
                </div>
                <div className="mt-2">
                  <QuantityStepper
                    value={item.quantity}
                    min={1}
                    max={50}
                    removable
                    onRemove={() => remove(item.productId)}
                    onChange={(q) => setQuantity(item.productId, q)}
                    ariaLabel={`Quantity of ${item.name}`}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-lg">Summary</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Subtotal</dt>
              <dd>
                <Money kobo={subtotalKobo} />
              </dd>
            </div>
            <div className="flex justify-between text-[var(--color-subtle)]">
              <dt>Delivery fee</dt>
              <dd>Calculated at checkout</dd>
            </div>
          </dl>
          <div className="my-4 border-t border-[var(--color-line)]" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[var(--color-muted)]">Estimated total</span>
            <Money kobo={subtotalKobo} size="lg" />
          </div>
          <p className="mt-2 text-[12px] text-[var(--color-subtle)]">
            The server confirms every price and the final total when you check out.
          </p>
          <Button
            fullWidth
            size="lg"
            className="mt-4"
            iconRight={<ArrowRight className="size-4" />}
            onClick={() => router.push("/checkout")}
          >
            Go to checkout
          </Button>
          <Link
            href="/menu"
            className="mt-3 block text-center text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Add more items
          </Link>
        </aside>
      </div>
    </div>
  );
}
