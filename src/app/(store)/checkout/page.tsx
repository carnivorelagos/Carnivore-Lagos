"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bag, Motorcycle, Storefront, WarningCircle } from "@phosphor-icons/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCart } from "@/components/providers/CartProvider";
import {
  createOrder,
  getHistory,
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
import { CheckoutSkeleton } from "@/components/store/skeletons";
import { BRAND } from "@/lib/client/brand";
import { DeliveryMapField } from "@/components/map/DeliveryMapField";
import { AddressSearchField } from "@/components/map/AddressSearchField";
import { EmailVerifyPanel } from "@/components/checkout/EmailVerifyPanel";

type FieldErrors = Partial<
  Record<"name" | "phone" | "email" | "address" | "pin" | "fulfillment", string>
>;

export default function CheckoutPage() {
  const router = useRouter();
  const { customer, ready, refresh } = useAuth();
  const { items, hydrated, subtotalKobo, clear } = useCart();
  const settings = useAsyncData(() => getPublicSettings(), []);

  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // Signed-in (Google / email-link) customers get their verified email
  // filled in; guests type one or leave it blank. Derived rather than
  // copied into state, so it needs no effect.
  const history = useAsyncData(() => getHistory(), []);
  const [emailInput, setEmail] = useState("");
  const email = emailInput || (history.data?.securedEmail ?? "");
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
  // No sign-in gate: checkout is device-based (amendment 2). The only
  // guard left is "don't sit on an empty checkout".
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
  const emailTrimmed = email.trim();
  // A half-typed email must never reach the quote/order body — the server
  // rejects it with VALIDATION_ERROR, which the quote effect swallows
  // silently, leaving the delivery fee uncalculated and Pay disabled.
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
  const canQuote =
    !!fulfillment &&
    items.length > 0 &&
    name.trim().length > 0 &&
    isLikelyNigerianPhone(phoneClean) &&
    (emailTrimmed === "" || emailValid) &&
    (fulfillment === "PICKUP" || !!pin);

  const buildBody = useCallback(
    () => ({
      fulfillmentType: fulfillment as FulfillmentType,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      customerName: name.trim(),
      customerPhone: phoneClean,
      ...(emailValid ? { customerEmail: emailTrimmed } : {}),
      ...(fulfillment === "DELIVERY"
        ? {
            deliveryAddress: address.trim() || undefined,
            deliveryPin: pin ?? undefined,
          }
        : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }),
    [fulfillment, items, name, phoneClean, emailValid, emailTrimmed, address, pin, notes],
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
    if (emailTrimmed !== "" && !emailValid)
      next.email = "Enter a complete email, or leave it blank.";
    if (fulfillment === "DELIVERY") {
      if (!pin) next.pin = "Drop a pin for the delivery location.";
      if (address.trim().length === 0) next.address = "Add an address to help the rider.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [fulfillment, name, phoneClean, emailTrimmed, emailValid, pin, address]);

  // --- Place order + pay --------------------------------------
  const submit = useCallback(async () => {
    setPayError(null);
    if (!validate()) return;

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
          router.replace(`/order/${order.trackingSlug}`);
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
      router.replace(`/order/${order.trackingSlug}`);
    } catch (e) {
      const ids = unavailableProductIds(e);
      if (ids.length) setUnavailableIds(ids);
      setPayError(errorMessage(e));
      setPlacing(false);
    }
  }, [validate, buildBody, items, pin, clear, router]);

  const onEmailVerified = useCallback(async () => {
    await refresh();
    setEmailGateOpen(false);
    // Continue straight to payment (Section 22).
    void submit();
  }, [refresh, submit]);

  const s = settings.data;
  const bothFulfilment = !!s?.pickupEnabled && !!s?.deliveryEnabled;
  const displayTotalKobo = quote?.totalKobo ?? subtotalKobo;

  // Why Pay is disabled on a delivery order, in plain words. A delivery
  // order can't be priced (or paid) until these are filled in, and a
  // greyed-out button with no explanation reads as "the site is broken".
  const deliveryBlockers: string[] =
    fulfillment === "DELIVERY" && !canQuote
      ? [
          !pin ? "your delivery location" : null,
          name.trim().length === 0 ? "your name" : null,
          !isLikelyNigerianPhone(phoneClean) ? "a valid phone number" : null,
          emailTrimmed !== "" && !emailValid ? "a complete email (or clear it)" : null,
        ].filter((x): x is string => x !== null)
      : [];
  const blockersText =
    deliveryBlockers.length > 1
      ? `${deliveryBlockers.slice(0, -1).join(", ")} and ${deliveryBlockers[deliveryBlockers.length - 1]}`
      : (deliveryBlockers[0] ?? "");

  if (!ready || !hydrated || (items.length === 0 && !redirectingRef.current)) {
    return <CheckoutSkeleton />;
  }

  return (
    <div className="shell gutter py-6 animate-reveal sm:py-10">
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
            {fulfillment === "PICKUP" ? (
              <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug text-[var(--color-muted)]">
                <Storefront className="mt-px size-4 shrink-0" aria-hidden />
                <span>
                  Pick up at <span className="text-[var(--color-text)]">{BRAND.addressLine}</span>
                </span>
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
              <DeliveryMapField value={pin} onChange={setPin} onAddressResolved={setAddress} />
              {errors.pin ? (
                <p className="text-[12.5px] text-[var(--color-danger)]">{errors.pin}</p>
              ) : null}
              {/* Typing an address looks it up and drops the pin there — the pin
                  is what prices delivery and enables Pay. */}
              <AddressSearchField
                value={address}
                onTextChange={setAddress}
                hasPin={!!pin}
                error={errors.address}
                onPick={(s) => {
                  setPin({ lat: s.lat, lng: s.lng });
                  setAddress(s.label);
                  setErrors((prev) => ({ ...prev, pin: undefined, address: undefined }));
                }}
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
              This is the contact for this order — for pickup updates or the
              rider. No account needed.
            </p>
            <TextField
              label="Email for your receipt"
              type="email"
              inputMode="email"
              autoComplete="email"
              optionalHint
              value={email}
              error={
                errors.email ??
                (emailTrimmed !== "" && !emailValid
                  ? "Enter a complete email, or leave it blank."
                  : undefined)
              }
              onChange={(e) => setEmail(e.target.value)}
              hint="Needed to pay by card and to save this order to your history."
            />
            {history.data && !history.data.secured && history.data.googleEnabled ? (
              <p className="text-[13px] text-[var(--color-muted)]">
                Have an account?{" "}
                <a
                  href={`/api/auth/google/start?next=${encodeURIComponent("/checkout")}`}
                  className="font-semibold text-[var(--color-text)] underline underline-offset-4 hover:text-[var(--color-accent)]"
                >
                  Continue with Google
                </a>{" "}
                to fill in your email and keep your history. Or just carry on as a guest.
              </p>
            ) : null}
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

          <ul className="mt-3 space-y-2.5 text-sm">
            {items.map((i) => {
              const flagged = unavailableIds.includes(i.productId);
              return (
                <li
                  key={i.productId}
                  className={`flex items-center justify-between gap-3 ${flagged ? "text-[var(--color-danger)]" : ""}`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="relative inline-flex size-9 shrink-0 overflow-hidden rounded border border-[var(--color-line)] bg-[var(--color-raised)]">
                      {i.imageUrl ? (
                        <Image src={i.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 truncate">
                      <span className="tnum text-[var(--color-subtle)]">{i.quantity}×</span> {i.name}
                      {flagged ? " · unavailable" : ""}
                    </span>
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
                pendingLabel="Placing your order…"
                slowLabel="Still working — one moment"
                disabled={
                  placing ||
                  !fulfillment ||
                  unavailableIds.length > 0 ||
                  (fulfillment === "DELIVERY" && quoteState !== "ok")
                }
                onClick={() => void submit()}
                icon={<Bag className="size-4" weight="fill" />}
              >
                {`Pay ${formatNaira(displayTotalKobo)}`}
              </Button>
              {deliveryBlockers.length > 0 ? (
                <p className="mt-3 text-center text-[12.5px] text-[var(--color-warning)]">
                  To see your delivery fee and pay, add {blockersText}.
                </p>
              ) : null}
              {payError ? (
                <p className="mt-3 text-[12.5px] text-[var(--color-danger)]">{payError}</p>
              ) : null}
              <p className="mt-3 text-center text-[12px] text-[var(--color-subtle)]">
                Secured by Paystack. You&apos;ll confirm card details in their window.
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
