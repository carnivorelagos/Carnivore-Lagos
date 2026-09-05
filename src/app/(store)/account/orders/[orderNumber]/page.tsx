"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle, MapPinLine, Note, Storefront } from "@phosphor-icons/react";
import { getMyOrder } from "@/lib/client/endpoints";
import { isApiError } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { usePayOrder } from "@/lib/client/usePayOrder";
import { useToast } from "@/components/providers/ToastProvider";
import { RequireAuth } from "@/components/store/RequireAuth";
import { OrderTimeline } from "@/components/store/OrderTimeline";
import { OrderLineItems } from "@/components/store/OrderLineItems";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { formatDateTime, FULFILLMENT_LABEL } from "@/lib/client/format";
import { TERMINAL_STATUSES } from "@/lib/client/orderFlow";

function OrderDetailInner() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = params.orderNumber;
  const { toast } = useToast();
  const { pay, paying } = usePayOrder();
  const { data: order, status, error, reload } = useAsyncData(
    () => getMyOrder(orderNumber),
    [orderNumber],
  );
  const [payError, setPayError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep the page live through the whole order lifecycle, not just while
  // payment is pending — status advances (confirmed / preparing / ready /
  // out for delivery) come from the admin and there's no push guarantee.
  useEffect(() => {
    const status = order?.status;
    if (!status || TERMINAL_STATUSES.includes(status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const awaitingPay = status === "PENDING_PAYMENT" && order?.payment?.status !== "SUCCESS";
    pollRef.current = setInterval(() => reload(true), awaitingPay ? 8000 : 15000);
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
        `We couldn't reconcile that payment against ${order.orderNumber}. Please contact us before retrying.`,
      );
    } else {
      setPayError(result.message);
    }
  }, [order, pay, reload, toast]);

  const notFound = isApiError(error) && (error.status === 404 || error.code === "NOT_FOUND");

  if (notFound) {
    return (
      <div className="shell gutter py-16">
        <EmptyState
          icon={Note}
          title="We couldn't find that order"
          description="It may not exist or it isn't on this account."
          action={
            <Link href="/account/orders" className={buttonVariants({ variant: "secondary" })}>
              Back to your orders
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
      <Link
        href="/account/orders"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
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
          <p className="text-sm text-[var(--color-text)]">Payment received.</p>
        </div>
      ) : null}

      {awaitingPayment ? (
        <div className="mt-6 rounded-lg border border-[color-mix(in_oklab,var(--color-warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_9%,transparent)] p-4">
          <p className="font-display text-base text-[var(--color-text)]">Payment not completed</p>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            Finish paying to send this order to the kitchen.
          </p>
          <Button className="mt-3" loading={paying} onClick={() => void onPay()}>
            Pay now
          </Button>
          {payError ? (
            <p className="mt-2 text-[12.5px] text-[var(--color-danger)]">{payError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="mb-3 font-display text-lg">Progress</h2>
          <OrderTimeline status={order.status} fulfillmentType={order.fulfillmentType} />
        </section>

        <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
            {order.fulfillmentType === "DELIVERY" ? (
              <MapPinLine className="size-4" aria-hidden />
            ) : (
              <Storefront className="size-4" aria-hidden />
            )}
            {FULFILLMENT_LABEL[order.fulfillmentType]}
            {order.payment ? (
              <>
                <span className="text-[var(--color-line-strong)]">·</span>
                <PaymentStatusBadge status={order.payment.status} />
              </>
            ) : null}
          </div>

          {order.fulfillmentType === "DELIVERY" && order.deliveryAddress ? (
            <p className="mb-3 text-[13px] text-[var(--color-muted)]">
              Delivering to: {order.deliveryAddress}
            </p>
          ) : null}

          <OrderLineItems
            items={order.items}
            subtotalKobo={order.subtotalKobo}
            deliveryFeeKobo={order.deliveryFeeKobo}
            totalKobo={order.totalKobo}
            fulfillmentType={order.fulfillmentType}
          />

          {order.notes ? (
            <p className="mt-4 border-t border-[var(--color-line)] pt-3 text-[13px] text-[var(--color-muted)]">
              <span className="text-[var(--color-subtle)]">Notes: </span>
              {order.notes}
            </p>
          ) : null}
        </section>

        <Link href="/menu" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Order again
        </Link>
      </div>
    </div>
  );
}

export default function AccountOrderDetailPage() {
  return (
    <RequireAuth>
      <OrderDetailInner />
    </RequireAuth>
  );
}
