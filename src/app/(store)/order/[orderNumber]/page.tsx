"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, Copy, MapPinLine, Receipt, Storefront } from "@phosphor-icons/react";
import { getPublicOrder } from "@/lib/client/endpoints";
import { isApiError } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { usePayOrder } from "@/lib/client/usePayOrder";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDateTime, FULFILLMENT_LABEL } from "@/lib/client/format";
import { TERMINAL_STATUSES } from "@/lib/client/orderFlow";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { OrderTimeline } from "@/components/store/OrderTimeline";
import { OrderLineItems } from "@/components/store/OrderLineItems";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/feedback";

function OrderView() {
  const params = useParams<{ orderNumber: string }>();
  const search = useSearchParams();
  const ref = search.get("ref");
  const orderNumber = params.orderNumber;
  const { customer } = useAuth();
  const { toast } = useToast();
  const { pay, paying } = usePayOrder();

  const { data: order, status, error, reload } = useAsyncData(
    () => getPublicOrder(orderNumber, ref as string),
    [orderNumber, ref],
    { enabled: !!ref },
  );

  const [payError, setPayError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  // Poll across the whole order lifecycle (status advances come from the
  // admin), with a generous cap so an abandoned tab doesn't poll forever.
  useEffect(() => {
    const status = order?.status;
    const live = status ? !TERMINAL_STATUSES.includes(status) : false;
    if (!live) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const awaitingPay = status === "PENDING_PAYMENT" && order?.payment?.status !== "SUCCESS";
    pollRef.current = setInterval(() => {
      pollCount.current += 1;
      if (pollCount.current > 120 && pollRef.current) {
        clearInterval(pollRef.current);
        return;
      }
      reload(true);
    }, awaitingPay ? 8000 : 20000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [order?.status, order?.payment?.status, reload]);

  const onPay = useCallback(async () => {
    if (!order) return;
    setPayError(null);
    const result = await pay(order.id);
    if (result.kind === "paid" || result.kind === "pending" || result.kind === "already-paid") {
      reload(true);
      if (result.kind === "paid") toast({ tone: "success", title: "Payment received" });
    } else if (result.kind === "cancelled") {
      setPayError("Payment not completed - try again.");
    } else if (result.kind === "mismatch") {
      setPayError(
        `We couldn't reconcile that payment against ${order.orderNumber}. Please contact us with that number before retrying.`,
      );
    } else {
      setPayError(result.message);
    }
  }, [order, pay, reload, toast]);

  const copyLink = useCallback(() => {
    if (typeof window === "undefined") return;
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => toast({ tone: "success", title: "Link copied" }))
      .catch(() => toast({ tone: "warning", title: "Couldn't copy the link" }));
  }, [toast]);

  const notFound =
    !ref || (isApiError(error) && (error.status === 404 || error.code === "NOT_FOUND"));

  if (notFound) {
    return (
      <div className="shell gutter py-16">
        <EmptyState
          icon={Receipt}
          title="We couldn't find that order"
          description="The link may be incomplete or the reference doesn't match. If you placed this order while signed in, you can open it from your account."
          action={
            <Link href="/account/orders" className={buttonVariants({ variant: "secondary" })}>
              Go to your orders
            </Link>
          }
        />
      </div>
    );
  }

  if (status === "loading" || !order) {
    return (
      <div className="shell gutter grid min-h-[40vh] place-items-center py-16">
        <Spinner />
      </div>
    );
  }

  const awaitingPayment =
    order.status === "PENDING_PAYMENT" && order.payment?.status !== "SUCCESS";

  return (
    <div className="shell gutter max-w-2xl py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-[var(--color-subtle)]">
            Order
          </p>
          <h1 className="tnum font-mono text-2xl text-[var(--color-text)]">{order.orderNumber}</h1>
          <p className="mt-1 text-[13px] text-[var(--color-subtle)]">
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === "PAID" ? (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-[color-mix(in_oklab,var(--color-success)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-success)_9%,transparent)] px-4 py-3">
          <CheckCircle className="size-5 text-[var(--color-success)]" weight="fill" aria-hidden />
          <p className="text-sm text-[var(--color-text)]">
            Payment received. Your receipt is on its way by email.
          </p>
        </div>
      ) : null}

      {awaitingPayment ? (
        <div className="mt-6 rounded-lg border border-[color-mix(in_oklab,var(--color-warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_9%,transparent)] p-4">
          <p className="font-display text-base text-[var(--color-text)]">Complete your payment</p>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            This order is held until payment is confirmed.
          </p>
          {customer ? (
            <Button className="mt-3" loading={paying} onClick={() => void onPay()}>
              Pay now
            </Button>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(`/order/${order.orderNumber}?ref=${ref}`)}`}
              className={buttonVariants({ variant: "primary", className: "mt-3" })}
            >
              Sign in to pay
            </Link>
          )}
          {payError ? (
            <p className="mt-2 text-[12.5px] text-[var(--color-danger)]">{payError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8">
        <section>
          <h2 className="mb-3 font-display text-lg">Progress</h2>
          <OrderTimeline status={order.status} fulfillmentType={order.fulfillmentType} />
        </section>

        <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm text-[var(--color-muted)]">
            {order.fulfillmentType === "DELIVERY" ? (
              <MapPinLine className="size-4" aria-hidden />
            ) : (
              <Storefront className="size-4" aria-hidden />
            )}
            {FULFILLMENT_LABEL[order.fulfillmentType]}
            <span className="mx-1 text-[var(--color-line-strong)]">·</span>
            <PaymentStatusBadge status={order.payment.status} />
          </div>
          <OrderLineItems
            items={order.items}
            subtotalKobo={order.subtotalKobo}
            deliveryFeeKobo={order.deliveryFeeKobo}
            totalKobo={order.totalKobo}
            fulfillmentType={order.fulfillmentType}
          />
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyLink}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Copy className="size-4" aria-hidden /> Copy tracking link
          </button>
          <Link href="/menu" className={buttonVariants({ variant: "quiet", size: "sm" })}>
            Order again
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="shell gutter grid min-h-[40vh] place-items-center py-16">
          <Spinner />
        </div>
      }
    >
      <OrderView />
    </Suspense>
  );
}
