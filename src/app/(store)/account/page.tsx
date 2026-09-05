"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle, Phone, Receipt, SignOut, WarningCircle } from "@phosphor-icons/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { RequireAuth } from "@/components/store/RequireAuth";
import { EmailVerifyPanel } from "@/components/checkout/EmailVerifyPanel";
import { OrderUpdatesToggle } from "@/components/store/NotificationSettings";
import { Button, buttonVariants } from "@/components/ui/Button";
import { formatDate } from "@/lib/client/format";

function AccountInner() {
  const { customer, refresh, logout } = useAuth();
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!customer) return null;
  const emailVerified = !!customer.emailVerifiedAt;

  return (
    <div className="shell gutter max-w-xl py-8 sm:py-12">
      <h1 className="font-display text-3xl sm:text-4xl">Your account</h1>

      <dl className="mt-8 divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <dt className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-subtle)]">
              Phone
            </dt>
            <dd className="tnum mt-1 font-mono text-[var(--color-text)]">{customer.phone}</dd>
          </div>
          <Phone className="size-5 text-[var(--color-subtle)]" aria-hidden />
        </div>

        <div className="px-5 py-4">
          <dt className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-subtle)]">
            Name
          </dt>
          <dd className="mt-1 text-[var(--color-text)]">
            {customer.name || <span className="text-[var(--color-subtle)]">Not set</span>}
          </dd>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <dt className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-subtle)]">
                Email
              </dt>
              <dd className="mt-1 truncate text-[var(--color-text)]">
                {customer.email || <span className="text-[var(--color-subtle)]">Not set</span>}
              </dd>
            </div>
            {emailVerified ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-[var(--color-success)]">
                <CheckCircle weight="fill" className="size-4" aria-hidden />
                Verified
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-[var(--color-warning)]">
                <WarningCircle weight="fill" className="size-4" aria-hidden />
                Unverified
              </span>
            )}
          </div>

          {!emailVerified ? (
            verifying ? (
              <div className="mt-4">
                <EmailVerifyPanel
                  initialEmail={customer.email}
                  initialName={customer.name}
                  onVerified={async () => {
                    await refresh();
                    setVerifying(false);
                  }}
                />
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => setVerifying(true)}
              >
                {customer.email ? "Verify email" : "Add and verify email"}
              </Button>
            )
          ) : null}
          {!emailVerified ? (
            <p className="mt-2 text-[12px] text-[var(--color-subtle)]">
              A verified email is required to pay online.
            </p>
          ) : null}
        </div>

        <OrderUpdatesToggle />

        {customer.createdAt ? (
          <div className="px-5 py-4">
            <dt className="text-[12px] uppercase tracking-[0.14em] text-[var(--color-subtle)]">
              Member since
            </dt>
            <dd className="mt-1 text-[var(--color-muted)]">{formatDate(customer.createdAt)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/account/orders" className={buttonVariants({ variant: "secondary" })}>
          <Receipt className="size-4" aria-hidden /> Order history
        </Link>
        <Link href="/account/notifications" className={buttonVariants({ variant: "secondary" })}>
          <Bell className="size-4" aria-hidden /> Notifications
        </Link>
        <Button
          variant="quiet"
          loading={loggingOut}
          onClick={async () => {
            setLoggingOut(true);
            await logout();
            router.replace("/");
          }}
          icon={<SignOut className="size-4" />}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountInner />
    </RequireAuth>
  );
}
