"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle, Copy, MapPinLine, Receipt, Storefront } from "@phosphor-icons/react";
import { getOrderBySlug, secureHistory } from "@/lib/client/endpoints";
import { isApiError } from "@/lib/client/api";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { usePayOrder } from "@/lib/client/usePayOrder";
import { useToast } from "@/components/providers/ToastProvider";
import { errorMessage } from "@/lib/client/errors";
import { formatDateTime, FULFILLMENT_LABEL } from "@/lib/client/format";
import { TERMINAL_STATUSES } from "@/lib/client/orderFlow";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { OrderTimeline } from "@/components/store/OrderTimeline";
import { OrderLineItems } from "@/components/store/OrderLineItems";
import { TextField } from "@/components/ui/form";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/feedback";
import { OrderTrackingSkeleton } from "@/components/store/skeletons";

function SecureHistoryPrompt() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await secureHistory(email.trim());
      setSent(true);
      toast({ tone: "success", title: "Check your email" });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [email, toast]);

  if (sent) {
    return (
      <p className="text-[13px] text-[var(--color-muted)]">
        We sent a link to <span className="text-[var(--color-text)]">{email}</span>. Open it to keep
        this order history — and any saved card — reachable from any device.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <TextField
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        containerClassName="flex-1"
        value={email}
        error={err}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" loading={busy} pendingLabel="Sending…" className="sm:mt-[26px]">
        Send link
      </Button>
    </form>
  );
}

function OrderView() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { toast } = useToast();
  const { pay, paying } = usePayOrder();

  const { data: order, status, error, reload } = useAsyncData(
    () => getOrderBySlug(slug),
    [slug],
  );

  const [payError, setPayError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    const s = order?.status;
    const live = s ? !TERMINAL_STATUSES.includes(s) : false;
    if (!live) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const awaitingPay = s === "PENDING_PAYMENT" && order?.payment?.status !== "SUCCESS";
    pollRef.current = setInterval(
      () => {
        pollCount.current += 1;
        if (pollCount.current > 120 && pollRef.current) {
          clearInterval(pollRef.current);
          return;
        }
        reload(true);
      },
      awaitingPay ? 8000 : 20000,
    );
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [order?.status, order?.payment?.status, reload]);

  const onPay = useCallback(
    async (mode: "card" | "popup") => {
      if (!order) return;
      setPayError(null);
      const result = await pay(order.id, mode === "card" ? { savedCardSlug: order.trackingSlug } : undefined);
      if (result.kind === "paid" || result.kind === "pending" || result.kind === "already-paid") {
        reload(true);
        if (result.kind === "paid") toast({ tone: "success", title: "Payment received" });
      } else if (result.kind === "cancelled") {
        setPayError("Payment not completed — try again.");
      } else if (result.kind === "mismatch") {
        setPayError(
          `We couldn't reconcile that payment against ${order.orderNumber}. Contact us with that number before retrying.`,
        );
      } else {
        setPayError(result.message);
      }
    },
    [order, pay, reload, toast],
  );

  const copyLink = useCallback(() => {
    if (typeof window === "undefined") return;
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => toast({ tone: "success", title: "Link copied" }))
      .catch(() => toast({ tone: "warning", title: "Couldn't copy the link" }));
  }, [toast]);

  const notFound = isApiError(error) && (error.status === 404 || error.code === "NOT_FOUND");

  if (notFound) {
    return (
      <div className="shell gutter py-16">
        <EmptyState
          icon={Receipt}
          title="We couldn't find that order"
          description="The tracking link may be incomplete or mistyped."
          action={
            <Link href="/menu" className={buttonVariants({ variant: "secondary" })}>
              Back to the menu
            </Link>
          }
        />
      </div>
    );
  }

  if (status === "loading" || !order) {
    return <OrderTrackingSkeleton />;
  }

  const awaitingPayment =
    order.status === "PENDING_PAYMENT" && order.payment?.status !== "SUCCESS";
  const justConfirmed = order.status === "PAID";

  return (
    <div className="shell gutter max-w-2xl py-8 animate-reveal sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Order</p>
          <h1 className="tnum font-mono text-2xl text-[var(--color-text)]">{order.orderNumber}</h1>
          <p className="mt-1 text-[13px] text-[var(--color-subtle)]">
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {justConfirmed ? (
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
          <div className="mt-3 flex flex-wrap gap-2">
            {order.canPayWithSavedCard ? (
              <Button
                loading={paying}
                pendingLabel="Charging your card…"
                slowLabel="Still working — one moment"
                onClick={() => void onPay("card")}
              >
                Pay with {order.savedCardLabel ?? "saved card"}
              </Button>
            ) : null}
            <Button
              variant={order.canPayWithSavedCard ? "secondary" : "primary"}
              loading={paying}
              pendingLabel="Opening Paystack…"
              slowLabel="Still working — one moment"
              onClick={() => void onPay("popup")}
            >
              {order.canPayWithSavedCard ? "Use a different method" : "Pay now"}
            </Button>
          </div>
          {payError ? (
            <p className="mt-2 text-[12.5px] text-[var(--color-danger)]">{payError}</p>
          ) : null}
        </div>
      ) : null}

      {justConfirmed && order.ownedByThisDevice ? (
        <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h2 className="font-display text-base">Never lose this</h2>
          <p className="mb-3 mt-1 text-[13px] text-[var(--color-muted)]">
            Secure your order history — one email link, and it&apos;s recoverable from any device. No
            password.
          </p>
          <SecureHistoryPrompt />
        </section>
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
            {order.payment ? (
              <>
                <span className="mx-1 text-[var(--color-line-strong)]">·</span>
                <PaymentStatusBadge status={order.payment.status} />
              </>
            ) : null}
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
          <Link href="/history" className={buttonVariants({ variant: "quiet", size: "sm" })}>
            Your orders
          </Link>
          <Link href="/menu" className={buttonVariants({ variant: "quiet", size: "sm" })}>
            Order again
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return <OrderView />;
}
