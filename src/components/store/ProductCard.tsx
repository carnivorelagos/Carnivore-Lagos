"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Check, ForkKnife, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Money } from "@/components/ui/Money";
import type { ProductListItem } from "@/lib/client/types";

export function ProductCard({
  product,
  unavailable = false,
  className,
}: {
  product: ProductListItem;
  /** Flagged by a PRODUCT_UNAVAILABLE at checkout, or an admin toggle. */
  unavailable?: boolean;
  className?: string;
}) {
  const { add } = useCart();
  const { toast } = useToast();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onAdd = useCallback(() => {
    const result = add(
      {
        productId: product.id,
        name: product.name,
        priceKobo: product.priceKobo,
        imageUrl: product.imageUrl,
      },
      1,
    );
    if (result === "cart-full") {
      toast({
        tone: "warning",
        title: "Cart is full",
        description: "You can order up to 30 different items at once.",
      });
      return;
    }
    if (result === "at-max-qty") {
      toast({ tone: "warning", title: "That's the max", description: "Up to 50 of one item." });
      return;
    }
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1400);
  }, [add, product, toast]);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]",
        "transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-out-quint)]",
        "hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-raise)]",
        className,
      )}
    >
      <Link
        href={`/product/${product.id}`}
        className="relative block aspect-[4/3] overflow-hidden bg-[var(--color-raised)]"
        tabIndex={-1}
        aria-hidden
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
              unavailable && "opacity-40 grayscale",
            )}
          />
        ) : (
          <span className="grid size-full place-items-center text-[var(--color-subtle)]">
            <ForkKnife className="size-8" aria-hidden />
          </span>
        )}
        {unavailable ? (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--color-bg)]/85 px-2 py-1 text-[11px] font-medium text-[var(--color-muted)]">
            Unavailable
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm font-medium leading-snug">
          <Link
            href={`/product/${product.id}`}
            className="after:absolute after:inset-0 after:content-[''] hover:text-[var(--color-text)]"
          >
            {product.name}
          </Link>
        </h3>
        {product.description ? (
          <p className="line-clamp-2 text-[12.5px] leading-snug text-[var(--color-muted)]">
            {product.description}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          <Money kobo={product.priceKobo} size="sm" />
          <button
            type="button"
            onClick={onAdd}
            disabled={unavailable}
            aria-label={`Add ${product.name} to cart`}
            className={cn(
              "relative z-10 inline-flex size-9 items-center justify-center rounded-md border transition-colors",
              unavailable
                ? "cursor-not-allowed border-[var(--color-line)] text-[var(--color-subtle)]"
                : justAdded
                  ? "border-[var(--color-success)] text-[var(--color-success)]"
                  : "border-[var(--color-line-strong)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] active:translate-y-px",
            )}
          >
            {justAdded ? <Check className="size-4" weight="bold" /> : <Plus className="size-4" />}
          </button>
        </div>
      </div>
    </article>
  );
}
