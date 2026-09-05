"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ForkKnife } from "@phosphor-icons/react";
import { getProduct } from "@/lib/client/endpoints";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { isApiError } from "@/lib/client/api";
import { errorMessage } from "@/lib/client/errors";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useCartSheet } from "@/components/store/CartSheet";
import { Button, buttonVariants } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/feedback";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { formatNaira } from "@/lib/client/format";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: product, status, error, reload } = useAsyncData(() => getProduct(id), [id]);
  const { add } = useCart();
  const { toast } = useToast();
  const cartSheet = useCartSheet();
  const [qty, setQty] = useState(1);

  const onAdd = useCallback(() => {
    if (!product) return;
    const result = add(
      {
        productId: product.id,
        name: product.name,
        priceKobo: product.priceKobo,
        imageUrl: product.imageUrl,
      },
      qty,
    );
    if (result === "cart-full") {
      toast({
        tone: "warning",
        title: "Cart is full",
        description: "Up to 30 different items per order.",
      });
      return;
    }
    toast({ tone: "success", title: "Added to cart", description: `${qty} × ${product.name}` });
    setQty(1);
    cartSheet.open();
  }, [product, qty, add, toast, cartSheet]);

  const notFound = isApiError(error) && (error.status === 404 || error.code === "NOT_FOUND");

  return (
    <div className="shell gutter py-6 sm:py-10">
      <Link
        href="/menu"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to menu
      </Link>

      {status === "loading" ? (
        <div className="grid gap-8 sm:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4 pt-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>
      ) : status === "error" && notFound ? (
        <EmptyState
          icon={ForkKnife}
          title="This item is no longer available"
          description="It may have been taken off the menu. Have a look at what's on now."
          action={
            <Link href="/menu" className={buttonVariants({ variant: "primary" })}>
              Back to the menu
            </Link>
          }
        />
      ) : status === "error" || !product ? (
        <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
      ) : (
        <>
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-12">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 640px) 100vw, 45vw"
                  className={product.isAvailable ? "object-cover" : "object-cover opacity-40 grayscale"}
                />
              ) : (
                <span className="grid size-full place-items-center text-[var(--color-subtle)]">
                  <ForkKnife className="size-12" aria-hidden />
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <h1 className="font-display text-3xl leading-tight sm:text-4xl">{product.name}</h1>
              {product.description ? (
                <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-[var(--color-muted)]">
                  {product.description}
                </p>
              ) : null}

              <Money kobo={product.priceKobo} size="display" className="mt-5" />

              {!product.isAvailable ? (
                <p className="mt-5 inline-flex w-fit items-center rounded-md border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-muted)]">
                  Currently unavailable
                </p>
              ) : (
                <div className="mt-6 hidden items-center gap-3 sm:flex">
                  <QuantityStepper value={qty} onChange={setQty} min={1} max={50} />
                  <Button size="lg" onClick={onAdd} className="flex-1">
                    Add to cart · {formatNaira(product.priceKobo * qty)}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile sticky add bar */}
          {product.isAvailable ? (
            <div className="fixed inset-x-0 bottom-20 z-40 border-t border-[var(--color-line)] bg-[color-mix(in_oklab,var(--color-bg)_94%,transparent)] px-4 py-3 backdrop-blur-md sm:hidden">
              <div className="flex items-center gap-3">
                <QuantityStepper value={qty} onChange={setQty} min={1} max={50} />
                <Button size="lg" onClick={onAdd} className="flex-1">
                  Add · {formatNaira(product.priceKobo * qty)}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
