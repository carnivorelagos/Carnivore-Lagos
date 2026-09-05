"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bag, Motorcycle, Storefront, WarningCircle } from "@phosphor-icons/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import {
  createOrder,
  getPublicSettings,
  getQuote,
  initializePayment,
  verifyPayment,
} from "@/lib/client/endpoints";
import { unavailableProductIds } from "@/lib/client/api";
import { errorCode, errorMessage } from "@/lib/client/errors";
import { runPaystackCheckout } from "@/lib/client/paystack";
import { cartHash, clearCheckoutSession, getIdempotencyKey } from "@/lib/client/checkoutSession";
import { cleanPhone, formatNaira, isLikelyNigerianPhone } from "@/lib/client/format";
import { useAsyncData } from "@/lib/client/useAsyncData";
import type { CheckoutQuote, FulfillmentType, LatLng } from "@/lib/client/types";
import { TextField, TextArea } from "@/components/ui/form";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Spinner } from "@/components/ui/feedback";
import { DeliveryMapField } from "@/components/map/DeliveryMapField";
import { EmailVerifyPanel } from "@/components/checkout/EmailVerifyPanel";

type FieldErrors = Partial<Record<"name" | "phone" | "address" | "pin" | "fulfillment", string>>;

export default function CheckoutPage() {
  const router = useRouter();
  const { customer, ready, refresh } = useAuth();
  const { items, hydrated, subtotalKobo, clear } = useCart();
  const settings = useAsyncData(() => getPublicSettings(), []);

  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);

  const [emailGateOpen, setEmailGateOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const quoteRun = useRef(0);
  const redirectingRef = useRef(false);

  // --- Guards --------------------------------------------------------
  useEffect(() => {
    if (ready && !customer) router.replace("/login?redirect=/checkout");
  }, [ready, customer, router]);

  useEffect(() => {
    if (hydrated && items.length === 0 && !redirectingRef.current) {
      router.replace("/menu");
    }
  }, [hydrated, items.length, router]);

  // Prefill contact from the account so a quote can fire immediately.
  useEffect(() => {
    if (!customer) return;
    setName((n) => n || customer.name || "");
    setPhone((p) => p || customer.phone || "");
  }, [customer]);

  // Default / constrain fulfillment from public settings.
  useEffect(() => {
    const s = settings.data;
    if (!s || fulfillment) return;
    if (s.pickupEnabled && !s.deliveryEnabled) setFulfillment("PICKUP");
    else if (!s.pickupEnabled && s.deliveryEnabled) setFulfillment("DELIVERY");
    else if (s.pickupEnabled && s.deliveryEnabled) setFulfillment("PICKUP");
  }, [settings.data, fulfillment]);

  const itemsSig = useMemo(
    () => items.map((i) => `${i.productId}:${i.quantity}`).join(","),
    [items],
  );

  const phoneClean = cleanPhone(phone);
  const canQuote =
    !!fulfillment &&
    items.length > 0 &&
    name.trim().length > 0 &&
    isLikelyNigerianPhone(phoneClean) &&
    (fulfillment === "PICKUP" || !!pin);

  const buildBody = useCallback(
    () => ({
      fulfillmentType: fulfillment as FulfillmentType,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      customerName: name.trim(),
      customerPhone: phoneClean,
      ...(customer?.email ? { customerEmail: customer.email } : {}),
      ...(fulfillment === "DELIVERY"
        ? {
            deliveryAddress: address.trim() || undefined,
            deliveryPin: pin ?? undefined,
          }
        : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }),
    [fulfillment, items, name, phoneClean, customer?.email, address, pin, notes],
  );

  // --- Live quote (debounced) -------------------------------------
  useEffect(() => {
    if (!canQuote) {
      setQuote(null);
      setQuoteState("idle");
      setQuoteMessage(null);
      return;
    }
    const id = ++quoteRun.current;
    setQuoteState("loading");
    const t = setTimeout(async () => {
      try {
        const q = await getQuote(buildBody());
        if (id !== quoteRun.current) return;
        setQuote(q);
        setQuoteState("ok");
        setQuoteMessage(null);
        setUnavailableIds([]);
      } catch (e) {
        if (id !== quoteRun.current) return;
        setQuote(null);
        setQuoteState("error");
        const code = errorCode(e);
        if (code === "PRODUCT_UNAVAILABLE") {
          setUnavailableIds(unavailableProductIds(e));
          setQuoteMessage("Some items in your cart are no longer available.");
        } else if (code === "VALIDATION_ERROR") {
          setQuoteMessage(null);
          setQuoteState("idle");
        } else {
          setQuoteMessage(errorMessage(e));
        }
      }
    }, 500);
    return () => clearTimeout(t);
  }, [canQuote, itemsSig, fulfillment, pin?.lat, pin?.lng, name, phoneClean, address, notes, buildBody]);

  // --- Validation ------------------------------------------------
  const validate = useCallback((): boolean => {
    const next: FieldErrors = {};
    if (!fulfillment) next.fulfillment = "Choose pickup or delivery.";
    if (name.trim().length === 0) next.name = "Enter the name for the order.";
    if (!isLikelyNigerianPhone(phoneClean))
      next.phone = "Enter a valid Nigerian phone number.";
    if (fulfillment === "DELIVERY") {
      if (!pin) next.pin = "Drop a pin for the delivery location.";
      if (address.trim().length === 0) next.address = "Add an address to help the rider.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [fulfillment, name, phoneClean, pin, address]);

  // --- Place order + pay --------------------------------------
  const submit = useCallback(async () => {
    setPayError(null);
    if (!validate()) return;
    if (customer && !customer.emailVerifiedAt) {
      setEmailGateOpen(true);
      return;
    }

    setPlacing(true);
    try {
      const body = buildBody();
      const hash = cartHash(items, body.fulfillmentType, pin);
      const idempotencyKey = getIdempotencyKey(hash);
      const order = await createOrder({ ...body, idempotencyKey });

      let accessCode: string;
      try {
        const init = await initializePayment(order.id);
        accessCode = init.accessCode;
      } catch (e) {
        const c = errorCode(e);
        if (c === "ORDER_ALREADY_PAID") {
          redirectingRef.current = true;
          clearCheckoutSession();
          clear();
          router.replace(`/account/orders/${order.orderNumber}`);
          return;
        }
        if (c === "EMAIL_NOT_VERIFIED") {
          setEmailGateOpen(true);
          setPlacing(false);
          return;
        }
        throw e;
      }

      const result = await runPaystackCheckout(accessCode);

      if (result.outcome === "cancelled") {
        setPayError("Payment not completed - try again.");
        setPlacing(false);
        return;
      }
      if (result.outcome === "error") {
        setPayError(result.message);
        setPlacing(false);
        return;
      }

      // Paystack reported success - the server verify is what's authoritative.
      try {
        const verified = await verifyPayment(result.reference);
        if (verified.amountMismatch) {
          setPayError(
            `We couldn't reconcile this payment against order ${order.orderNumber}. Please contact us with that number before trying again - do not re-pay.`,
          );
          setPlacing(false);
          return;
        }
      } catch {
        // Verify call failed; the Paystack webhook will still reconcile.
        // The tracking page re-checks and shows the real state.
      }

      redirectingRef.current = true;
      clearCheckoutSession();
      clear();
      router.replace(
        `/order/${order.orderNumber}?ref=${encodeURIComponent(result.reference)}`,
      );
    } catch (e) {
      const ids = unavailableProductIds(e);
      if (ids.length) setUnavailableIds(ids);
      setPayError(errorMessage(e));
      setPlacing(false);
    }
  }, [validate, customer, buildBody, items, pin, clear, router]);

  const onEmailVerified = useCallback(async () => {
    await refresh();
    setEmailGateOpen(false);
    // Continue straight to payment (Section 22).
    void submit();
  }, [refresh, submit]);

  const s = settings.data;
  const bothFulfilment = !!s?.pickupEnabled && !!s?.deliveryEnabled;
  const displayTotalKobo = quote?.totalKobo ?? subtotalKobo;

  if (!ready || !hydrated || (items.length === 0 && !redirectingRef.current)) {
    return (
      <div className="shell gutter grid min-h-[50vh] place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="shell gutter py-6 sm:py-10">
      <h1 className="mb-6 font-display text-3xl sm:text-4xl">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        {/* --- Left: the form ------------------------------------ */}
        <div className="space-y-8">
          {/* Fulfilment */}
          <section>
            <h2 className="mb-3 font-display text-lg">How do you want it?</h2>
            {settings.status === "loading" ? (
              <div className="h-20 skeleton rounded-lg" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(["PICKUP", "DELIVERY"] as FulfillmentType[]).map((f) => {
                  const enabled =
                    f === "PICKUP" ? s?.pickupEnabled !== false : s?.deliveryEnabled !== false;
                  const active = fulfillment === f;
                  const Icon = f === "PICKUP" ? Storefront : Motorcycle;
                  return (
                    <button
                      key={f}
                      type="button"
                      disabled={!enabled}
                      onClick={() => setFulfillment(f)}
                      className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active
                          ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)]"
                          : "border-[var(--color-line-strong)] hover:border-[var(--color-muted)]"
                      }`}
                    >
                      <Icon className="size-5 text-[var(--color-accent)]" aria-hidden />
                      <span className="text-sm font-medium">
                        {f === "PICKUP" ? "Pickup" : "Delivery"}
                      </span>
                      <span className="text-[12px] text-[var(--color-subtle)]">
                        {f === "PICKUP" ? "Collect at the counter" : "Rider brings it to you"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {!bothFulfilment && settings.status === "ready" ? (
              <p className="mt-2 text-[12px] text-[var(--color-subtle)]">
                {s?.pickupEnabled && !s?.deliveryEnabled
                  ? "Delivery is paused right now - pickup only."
                  : !s?.pickupEnabled && s?.deliveryEnabled
                    ? "Pickup is paused right now - delivery only."
                    : "Ordering is paused right now. Please check back shortly."}
              </p>
            ) : null}
            {errors.fulfillment ? (
              <p className="mt-2 text-[12.5px] text-[var(--color-danger)]">{errors.fulfillment}</p>
            ) : null}
          </section>

          {/* Delivery details */}
          {fulfillment === "DELIVERY" ? (
            <section className="space-y-4">
              <h2 className="font-display text-lg">Where to?</h2>
              <DeliveryMapField value={pin} onChange={setPin} />
              {errors.pin ? (
                <p className="text-[12.5px] text-[var(--color-danger)]">{errors.pin}</p>
              ) : null}
              <TextArea
                label="Address & directions"
                placeholder="Street, building, landmark, and anything that helps the rider find you"
                rows={2}
                value={address}
                error={errors.address}
                onChange={(e) => setAddress(e.target.value)}
              />
              {s?.maxDeliveryDistanceKm != null ? (
                <p className="text-[12px] text-[var(--color-subtle)]">
                  We deliver within about {s.maxDeliveryDistanceKm} km of the kitchen.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Contact */}
          <section className="space-y-4">
            <h2 className="font-display text-lg">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Name for the order"
                autoComplete="name"
                value={name}
                error={errors.name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                label="Phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                error={errors.phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <p className="text-[12px] text-[var(--color-subtle)]">
              This is the contact for this order. Your account phone stays{" "}
              <span className="tnum">{customer?.phone}</span>.
            </p>
          </section>

          {/* Notes */}
          <section>
            <TextArea
              label="Notes for the kitchen"
              optionalHint
              placeholder="Allergies, spice level, no onions…"
              rows={2}
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>
        </div>

        {/* --- Right: summary + pay -------------------------------- */}
        <aside className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-lg">Order</h2>

          <ul className="mt-3 space-y-2 text-sm">
            {items.map((i) => {
              const flagged = unavailableIds.includes(i.productId);
              return (
                <li
                  key={i.productId}
                  className={`flex justify-between gap-3 ${flagged ? "text-[var(--color-danger)]" : ""}`}
                >
                  <span className="min-w-0 truncate">
                    <span className="tnum text-[var(--color-subtle)]">{i.quantity}×</span> {i.name}
                    {flagged ? " · unavailable" : ""}
                  </span>
                  <span className="tnum shrink-0 text-[var(--color-muted)]">
                    {formatNaira(i.priceKobo * i.quantity)}
                  </span>
                </li>
              );
            })}
          </ul>

          {unavailableIds.length > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-danger)_10%,transparent)] p-3 text-[12.5px] text-[var(--color-danger)]">
              <WarningCircle className="mt-px size-4 shrink-0" weight="fill" aria-hidden />
              <span>
                Remove the flagged items to continue.{" "}
                <Link href="/cart" className="underline">
                  Edit cart
                </Link>
              </span>
            </div>
          ) : null}

          <div className="my-4 border-t border-[var(--color-line)]" />

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">Subtotal</dt>
              <dd>
                <Money kobo={quote?.subtotalKobo ?? subtotalKobo} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-muted)]">
                {fulfillment === "DELIVERY" ? "Delivery fee" : "Pickup"}
              </dt>
              <dd className="text-right">
                {fulfillment !== "DELIVERY" ? (
                  <span className="text-[var(--color-muted)]">Free</span>
                ) : quoteState === "loading" ? (
                  <span className="text-[var(--color-subtle)]">Calculating…</span>
                ) : quote ? (
                  <Money kobo={quote.deliveryFeeKobo} />
                ) : (
                  <span className="text-[var(--color-subtle)]">-</span>
                )}
              </dd>
            </div>
            {quote?.deliveryDistanceKm != null ? (
              <div className="flex justify-between text-[12px] text-[var(--color-subtle)]">
                <dt>Distance</dt>
                <dd className="tnum">{quote.deliveryDistanceKm.toFixed(1)} km</dd>
              </div>
            ) : null}
          </dl>

          <div className="my-4 border-t border-[var(--color-line)]" />

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-[var(--color-muted)]">Total</span>
            <Money kobo={displayTotalKobo} size="lg" />
          </div>
          {quoteState !== "ok" ? (
            <p className="mt-1 text-[12px] text-[var(--color-subtle)]">
              Final total is confirmed by the server before you pay.
            </p>
          ) : null}

          {quoteMessage && quoteState === "error" ? (
            <p className="mt-3 text-[12.5px] text-[var(--color-danger)]">{quoteMessage}</p>
          ) : null}

          {emailGateOpen && customer ? (
            <div className="mt-4">
              <EmailVerifyPanel
                initialEmail={customer.email}
                initialName={name || customer.name}
                onVerified={onEmailVerified}
              />
            </div>
          ) : (
            <>
              <Button
                fullWidth
                size="lg"
                className="mt-4"
                loading={placing}
                disabled={
                  placing ||
                  !fulfillment ||
                  unavailableIds.length > 0 ||
                  (fulfillment === "DELIVERY" && quoteState !== "ok")
                }
                onClick={() => void submit()}
                icon={<Bag className="size-4" weight="fill" />}
              >
                {placing ? "Opening payment…" : `Pay ${formatNaira(displayTotalKobo)}`}
              </Button>
              {payError ? (
                <p className="mt-3 text-[12.5px] text-[var(--color-danger)]">{payError}</p>
              ) : null}
              <p className="mt-3 text-center text-[12px] text-[var(--color-subtle)]">
                Secured by Paystack. You'll confirm card details in their window.
              </p>
            </>
          )}

          <Link
            href="/cart"
            className={buttonVariants({
              variant: "quiet",
              size: "sm",
              fullWidth: true,
              className: "mt-2",
            })}
          >
            Back to cart
          </Link>
        </aside>
      </div>
    </div>
  );
}
