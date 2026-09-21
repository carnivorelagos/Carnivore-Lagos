"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowClockwise, ClockCounterClockwise, CreditCard } from "@phosphor-icons/react";
import { getHistory, reorder as reorderApi, secureHistory } from "@/lib/client/endpoints";
import { useAsyncData } from "@/lib/client/useAsyncData";
import { errorMessage } from "@/lib/client/errors";
import { formatDateTime } from "@/lib/client/format";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Money } from "@/components/ui/Money";
import { TextField } from "@/components/ui/form";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/feedback";
import { HistorySkeleton } from "@/components/store/skeletons";
import { GoogleButton } from "@/components/store/GoogleButton";

function SecureBanner({ securedEmail, googleEnabled }: { securedEmail: string | null; googleEnabled: boolean }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (securedEmail) {
    return (
      <p className="text-[13px] text-[var(--color-muted)]">
        History secured to <span className="text-[var(--color-text)]">{securedEmail}</span>. On a new
        device, re-verify that address to bring it across.
      </p>
    );
  }

  if (sent) {
    return (
      <p className="text-[13px] text-[var(--color-muted)]">
        Link sent to <span className="text-[var(--color-text)]">{email}</span>. Open it to secure this
        history.
      </p>
    );
  }

  return (
    <>
    {googleEnabled ? (
      <div className="mb-4">
        <GoogleButton next="/history" />
        <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-[var(--color-subtle)]">
          or get an email link
        </p>
      </div>
    ) : null}
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        secureHistory(email.trim())
          .then(() => {
            setSent(true);
            toast({ tone: "success", title: "Check your email" });
          })
          .catch((x) => setErr(errorMessage(x)))
          .finally(() => setBusy(false));
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
        Secure it
      </Button>
    </form>
    </>
  );
}

function HistoryView() {
  const router = useRouter();
  const search = useSearchParams();
  const secured = search.get("secured");
  const signedIn = search.get("signin");
  const { toast } = useToast();
  const { add, clear } = useCart();
  const { data, status, reload } = useAsyncData(() => getHistory(), []);
  const [reordering, setReordering] = useState<string | null>(null);

  const doReorder = useCallback(
    async (slug: string) => {
      setReordering(slug);
      try {
        const { lines } = await reorderApi(slug);
        const usable = lines.filter((l) => l.available && l.productId && l.priceKobo != null);
        if (usable.length === 0) {
          toast({ tone: "warning", title: "Nothing to reorder", description: "Those items are unavailable now." });
          return;
        }
        clear();
        for (const l of usable) {
          add(
            { productId: l.productId!, name: l.name, priceKobo: l.priceKobo!, imageUrl: l.imageUrl },
            l.quantity,
          );
        }
        const dropped = lines.length - usable.length;
        toast({
          tone: "success",
          title: "Added to your cart",
          description: dropped > 0 ? `${dropped} unavailable item${dropped > 1 ? "s" : ""} skipped.` : undefined,
        });
        router.push("/cart");
      } catch (e) {
        toast({ tone: "warning", title: "Couldn't reorder", description: errorMessage(e) });
      } finally {
        setReordering(null);
      }
    },
    [add, clear, router, toast],
  );

  if (status === "loading" || !data) {
    return <HistorySkeleton />;
  }

  return (
    <div className="shell gutter max-w-2xl py-8 animate-reveal sm:py-12">
      <h1 className="font-display text-3xl sm:text-4xl">Your orders</h1>
      <p className="mt-1 text-[13px] text-[var(--color-subtle)]">
        {data.secured ? "Signed in - these follow you to any device." : "Remembered on this device - no account needed."}
      </p>

      {signedIn === "ok" ? (
        <p className="mt-4 rounded-md border border-[color-mix(in_oklab,var(--color-success)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-success)_9%,transparent)] px-3 py-2 text-[13px] text-[var(--color-text)]">
          You&apos;re signed in - your history is secured.
        </p>
      ) : signedIn === "failed" || signedIn === "cancelled" || signedIn === "unavailable" ? (
        <p className="mt-4 rounded-md border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-danger)_9%,transparent)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
          Google sign-in didn&apos;t go through. Try again, or use the email link below.
        </p>
      ) : secured === "1" ? (
        <p className="mt-4 rounded-md border border-[color-mix(in_oklab,var(--color-success)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-success)_9%,transparent)] px-3 py-2 text-[13px] text-[var(--color-text)]">
          Email confirmed — your history is secured.
        </p>
      ) : secured === "failed" ? (
        <p className="mt-4 rounded-md border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-danger)_9%,transparent)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
          That link was invalid or expired. Request a new one below.
        </p>
      ) : null}

      {data.savedCard ? (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
          <CreditCard className="size-4" aria-hidden />
          Saved card: {data.savedCard.brand ?? "Card"}{" "}
          {data.savedCard.last4 ? `···· ${data.savedCard.last4}` : ""}
        </p>
      ) : null}

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="font-display text-base">
          {data.secured ? "History secured" : "Never lose this"}
        </h2>
        <p className="mb-3 mt-1 text-[13px] text-[var(--color-muted)]">
          One email link makes this history — and any saved card — recoverable from any device.
        </p>
        <SecureBanner securedEmail={data.securedEmail} googleEnabled={data.googleEnabled} />
      </section>

      {data.orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={ClockCounterClockwise}
            title="No orders yet"
            description="When you order, it shows up here for one-tap reordering."
            action={
              <Link href="/menu" className={buttonVariants({ variant: "secondary" })}>
                Browse the menu
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {data.orders.map((o, i) => {
            const summary = o.items
              .map((it) => `${it.quantity}× ${it.productNameSnapshot}`)
              .join(", ");
            return (
              <li
                key={o.trackingSlug}
                style={{ "--i": i } as React.CSSProperties}
                className="stagger-item rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/order/${o.trackingSlug}`}
                    className="tnum font-mono text-sm text-[var(--color-text)] hover:text-[var(--color-accent)]"
                  >
                    {o.orderNumber}
                  </Link>
                  <OrderStatusBadge status={o.status} />
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--color-muted)]">{summary}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[12px] text-[var(--color-subtle)]">
                    {formatDateTime(o.createdAt)}
                  </span>
                  <div className="flex items-center gap-3">
                    <Money kobo={o.totalKobo} size="sm" />
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={reordering === o.trackingSlug}
                      pendingLabel="Adding…"
                      onClick={() => void doReorder(o.trackingSlug)}
                      icon={<ArrowClockwise className="size-4" aria-hidden />}
                    >
                      Reorder
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => reload(true)}
        className={buttonVariants({ variant: "quiet", size: "sm", className: "mt-6" })}
      >
        Refresh
      </button>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryView />
    </Suspense>
  );
}
