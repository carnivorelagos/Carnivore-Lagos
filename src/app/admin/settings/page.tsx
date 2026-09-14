"use client";

import { useEffect, useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { adminGetSettings, adminUpdateSettings } from "@/lib/client/endpoints";
import { errorMessage, fieldErrors } from "@/lib/client/errors";
import { koboToNairaInput, nairaInputToKobo } from "@/lib/client/format";
import type { AdminSettings, LatLng } from "@/lib/client/types";
import { useAdminData } from "@/components/admin/useAdminData";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Card } from "@/components/admin/primitives";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { TextField } from "@/components/ui/form";
import { Toggle } from "@/components/admin/Toggle";
import { Button } from "@/components/ui/Button";
import { DeliveryMapField } from "@/components/map/DeliveryMapField";
import { ErrorState } from "@/components/ui/feedback";

type FormState = {
  restaurantName: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  autoConfirmPaidOrders: boolean;
  lat: string;
  lng: string;
  ratePerKmNaira: string;
  minFeeNaira: string;
  maxDistanceKm: string;
};

function toForm(s: AdminSettings): FormState {
  return {
    restaurantName: s.restaurantName ?? "",
    pickupEnabled: s.pickupEnabled,
    deliveryEnabled: s.deliveryEnabled,
    autoConfirmPaidOrders: s.autoConfirmPaidOrders,
    lat: s.originLat != null ? String(s.originLat) : "",
    lng: s.originLng != null ? String(s.originLng) : "",
    ratePerKmNaira: koboToNairaInput(s.deliveryRatePerKmKobo),
    minFeeNaira: koboToNairaInput(s.minDeliveryFeeKobo),
    maxDistanceKm: s.maxDeliveryDistanceKm != null ? String(s.maxDeliveryDistanceKm) : "",
  };
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const { data, status, error, reload, setData } = useAdminData(() => adminGetSettings(), []);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data && !form) setForm(toForm(data));
  }, [data, form]);

  if (status === "loading" || !form) {
    return <AdminPageSkeleton rows={6} />;
  }
  if (status === "error") {
    return (
      <>
        <PageHeader title="Settings" />
        <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
      </>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const pin: LatLng | null =
    form.lat && form.lng && Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng))
      ? { lat: Number(form.lat), lng: Number(form.lng) }
      : null;

  const rateKobo = nairaInputToKobo(form.ratePerKmNaira) ?? 0;
  const minFeeKobo = nairaInputToKobo(form.minFeeNaira) ?? 0;
  const deliveryFree = form.deliveryEnabled && rateKobo === 0 && minFeeKobo === 0;
  const deliveryNoOrigin = form.deliveryEnabled && !pin;
  const bothOff = !form.pickupEnabled && !form.deliveryEnabled;

  const save = async () => {
    setErrs({});
    const local: Record<string, string> = {};
    if (!form.restaurantName.trim()) local.restaurantName = "Required.";
    if (nairaInputToKobo(form.ratePerKmNaira) === null && form.ratePerKmNaira.trim() !== "")
      local.ratePerKmNaira = "Enter an amount in Naira.";
    if (nairaInputToKobo(form.minFeeNaira) === null && form.minFeeNaira.trim() !== "")
      local.minFeeNaira = "Enter an amount in Naira.";
    if (Object.keys(local).length) {
      setErrs(local);
      return;
    }

    setBusy(true);
    try {
      const updated = await adminUpdateSettings({
        restaurantName: form.restaurantName.trim(),
        pickupEnabled: form.pickupEnabled,
        deliveryEnabled: form.deliveryEnabled,
        originLat: form.lat.trim() === "" ? null : Number(form.lat),
        originLng: form.lng.trim() === "" ? null : Number(form.lng),
        deliveryRatePerKmKobo: rateKobo,
        minDeliveryFeeKobo: minFeeKobo,
        maxDeliveryDistanceKm:
          form.maxDistanceKm.trim() === "" ? null : Number(form.maxDistanceKm),
        autoConfirmPaidOrders: form.autoConfirmPaidOrders,
      });
      setData(updated);
      setForm(toForm(updated));
      toast({ tone: "success", title: "Settings saved" });
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrs(fe);
      else toast({ tone: "danger", title: "Couldn't save", description: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Restaurant details, delivery pricing and fulfilment switches."
      />

      <div className="max-w-2xl space-y-5">
        {bothOff ? (
          <Warn>Pickup and delivery are both off. Customers can't place any orders.</Warn>
        ) : null}
        {deliveryNoOrigin ? (
          <Warn>
            Delivery is on but no origin pin is set. Every delivery order will fail until you set
            one below.
          </Warn>
        ) : null}
        {deliveryFree ? (
          <Warn>
            Delivery is on but the per-km rate and minimum fee are both ₦0 - every delivery is
            free. Set a rate or a minimum below if that's not intended.
          </Warn>
        ) : null}

        <Card className="space-y-4 p-5">
          <TextField
            label="Restaurant name"
            required
            value={form.restaurantName}
            error={errs.restaurantName}
            onChange={(e) => set("restaurantName", e.target.value)}
          />
          <div className="space-y-3 rounded-lg border border-line bg-bg p-4">
            <Toggle
              checked={form.pickupEnabled}
              onChange={(v) => set("pickupEnabled", v)}
              label="Pickup enabled"
            />
            <Toggle
              checked={form.deliveryEnabled}
              onChange={(v) => set("deliveryEnabled", v)}
              label="Delivery enabled"
            />
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-[13px] font-semibold text-text">Order flow</h2>
          <Toggle
            checked={form.autoConfirmPaidOrders}
            onChange={(v) => set("autoConfirmPaidOrders", v)}
            label="Auto-confirm paid orders"
          />
          <p className="text-[12px] text-subtle">
            When on, a paid order jumps straight to Confirmed with no click — the customer is
            notified and it lands in the kitchen queue. Turn off during a rush to screen orders
            (accept or cancel each one) before committing.
          </p>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-[13px] font-semibold text-text">Delivery pricing</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Rate per km (₦)"
              inputMode="decimal"
              placeholder="0"
              value={form.ratePerKmNaira}
              error={errs.ratePerKmNaira}
              onChange={(e) => set("ratePerKmNaira", e.target.value)}
            />
            <TextField
              label="Minimum fee (₦)"
              inputMode="decimal"
              placeholder="0"
              value={form.minFeeNaira}
              error={errs.minFeeNaira}
              onChange={(e) => set("minFeeNaira", e.target.value)}
            />
            <TextField
              label="Max distance (km)"
              inputMode="decimal"
              placeholder="No limit"
              value={form.maxDistanceKm}
              onChange={(e) => set("maxDistanceKm", e.target.value)}
            />
          </div>
          <p className="text-[12px] text-subtle">
            Fee = max(distance × rate, minimum). Straight-line distance from the origin pin.
          </p>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-[13px] font-semibold text-text">Kitchen origin</h2>
          <DeliveryMapField
            value={pin}
            onChange={(p) => {
              set("lat", p.lat.toFixed(6));
              set("lng", p.lng.toFixed(6));
            }}
            label="Origin pin"
            required={form.deliveryEnabled}
            emptyHint="Tap the map to set where deliveries start from."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Latitude"
              inputMode="decimal"
              value={form.lat}
              onChange={(e) => set("lat", e.target.value)}
            />
            <TextField
              label="Longitude"
              inputMode="decimal"
              value={form.lng}
              onChange={(e) => set("lng", e.target.value)}
            />
          </div>
        </Card>

        <div className="flex gap-2">
          <Button loading={busy} onClick={() => void save()}>
            Save settings
          </Button>
          <Button variant="secondary" onClick={() => data && setForm(toForm(data))} disabled={busy}>
            Reset
          </Button>
        </div>
      </div>
    </>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[color-mix(in_oklab,var(--color-warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_10%,transparent)] p-3 text-[12.5px] text-[var(--color-warning)]">
      <WarningCircle weight="fill" className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
