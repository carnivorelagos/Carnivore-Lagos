"use client";

import { useState } from "react";
import { Copy } from "@phosphor-icons/react";
import {
  adminCreateRider,
  adminGetRiders,
  adminUpdateRider,
} from "@/lib/client/endpoints";
import { errorMessage, fieldErrors } from "@/lib/client/errors";
import { relativeTime } from "@/lib/client/format";
import { isRiderLocationFresh } from "@/lib/riders";
import type { AdminRider } from "@/lib/client/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Card } from "@/components/admin/primitives";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { Toggle } from "@/components/admin/Toggle";
import { TextField } from "@/components/ui/form";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/feedback";

function trackingLink(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/rider/${token}`;
}

function LiveDot({ rider }: { rider: AdminRider }) {
  const fresh = rider.lastSeenAt && isRiderLocationFresh(new Date(rider.lastSeenAt));
  if (!rider.lastSeenAt) {
    return <span className="text-[12px] text-subtle">Hasn&apos;t opened their link yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-subtle">
      <span
        aria-hidden
        className={`inline-block size-1.5 rounded-full ${fresh ? "bg-[var(--color-success)]" : "bg-[var(--color-line-strong)]"}`}
      />
      {fresh ? "Live now" : `Last seen ${relativeTime(rider.lastSeenAt)}`}
    </span>
  );
}

function RiderRow({ rider, onSaved }: { rider: AdminRider; onSaved: (r: AdminRider) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(rider.name);
  const [phone, setPhone] = useState(rider.phone);
  const [email, setEmail] = useState(rider.email ?? "");
  const [isActive, setIsActive] = useState(rider.isActive);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const dirty =
    name.trim() !== rider.name ||
    phone.trim() !== rider.phone ||
    email.trim() !== (rider.email ?? "") ||
    isActive !== rider.isActive;

  const save = async () => {
    setBusy(true);
    setErr(null);
    setEmailErr(null);
    try {
      const saved = await adminUpdateRider(rider.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() === "" ? null : email.trim(),
        isActive,
      });
      onSaved(saved);
      toast({ tone: "success", title: "Rider saved" });
    } catch (e) {
      const fe = fieldErrors(e);
      setEmailErr(fe.email ?? null);
      setErr(fe.name ?? fe.phone ?? (fe.email ? null : errorMessage(e)));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    void navigator.clipboard
      ?.writeText(trackingLink(rider.token))
      .then(() => toast({ tone: "success", title: "Link copied", description: "Send it to the rider - that's their whole onboarding." }))
      .catch(() => toast({ tone: "warning", title: "Couldn't copy the link" }));
  };

  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <TextField label="Name" value={name} error={err} onChange={(e) => setName(e.target.value)} />
        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <TextField
          label="Email"
          type="email"
          optionalHint
          hint="New deliveries are emailed here, with their link."
          value={email}
          error={emailErr}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button size="sm" disabled={!dirty || busy} loading={busy} onClick={() => void save()}>
          Save
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Toggle
          checked={isActive}
          onChange={setIsActive}
          label="Active"
          description="Inactive riders can't be assigned, and their link stops working."
        />
        <div className="flex flex-col items-end gap-1.5">
          <Button size="sm" variant="quiet" icon={<Copy className="size-3.5" aria-hidden />} onClick={copyLink}>
            Copy tracking link
          </Button>
          <LiveDot rider={rider} />
        </div>
      </div>
    </Card>
  );
}

function AddRider({ onCreated }: { onCreated: (r: AdminRider) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<{ name?: string; phone?: string; email?: string }>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrs({});
    try {
      const created = await adminCreateRider({
        name: name.trim(),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      onCreated(created);
      setName("");
      setPhone("");
      setEmail("");
      toast({ tone: "success", title: "Rider added" });
    } catch (e2) {
      const fe = fieldErrors(e2);
      if (fe.name || fe.phone || fe.email) setErrs(fe);
      else toast({ tone: "danger", title: "Couldn't add rider", description: errorMessage(e2) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-raise)]">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <TextField label="Name" value={name} error={errs.name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Phone"
          placeholder="0801 234 5678"
          value={phone}
          error={errs.phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <TextField
          label="Email"
          type="email"
          optionalHint
          value={email}
          error={errs.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" size="sm" loading={busy}>
          Add rider
        </Button>
      </div>
    </form>
  );
}

export default function AdminRidersPage() {
  const { data, status, error, reload, setData } = useAdminData(() => adminGetRiders(), []);

  const upsert = (r: AdminRider) =>
    setData((prev) => {
      const list = prev ?? [];
      const exists = list.some((x) => x.id === r.id);
      const next = exists ? list.map((x) => (x.id === r.id ? r : x)) : [r, ...list];
      return [...next].sort(
        (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name),
      );
    });

  return (
    <>
      <PageHeader
        title="Riders"
        description="Your own delivery staff. Add a rider and send them their link - that's the entire onboarding, no login."
      />

      {status === "loading" ? (
        <AdminPageSkeleton header={false} rows={6} />
      ) : status === "error" ? (
        <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
      ) : (
        <div className="max-w-2xl space-y-3">
          <AddRider onCreated={upsert} />
          {(data ?? []).length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted">No riders yet.</p>
          ) : (
            data!.map((r) => <RiderRow key={r.id} rider={r} onSaved={upsert} />)
          )}
        </div>
      )}
    </>
  );
}
