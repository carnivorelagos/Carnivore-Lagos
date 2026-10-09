"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Motorcycle, Trash } from "@phosphor-icons/react";
import {
  adminAssignRider,
  adminDeleteOrder,
  adminGetOrder,
  adminGetRiders,
  adminSetOrderStatus,
} from "@/lib/client/endpoints";
import { errorCode, errorMessage } from "@/lib/client/errors";
import { isApiError } from "@/lib/client/api";
import { allowedNextStatuses, TRANSITION_VERB } from "@/lib/client/orderFlow";
import {
  formatDateTime,
  FULFILLMENT_LABEL,
  ORDER_STATUS_LABEL,
  relativeTime,
} from "@/lib/client/format";
import type { OrderStatus } from "@/lib/client/types";
import { isRiderLocationFresh } from "@/lib/riders";
import { useAdminData } from "@/components/admin/useAdminData";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader, Card } from "@/components/admin/primitives";
import { AdminPageSkeleton } from "@/components/admin/AdminPageSkeleton";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/Badge";
import { OrderLineItems } from "@/components/store/OrderLineItems";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Overlay";
import { SelectField } from "@/components/ui/form";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { LiveTrackingMap } from "@/components/map/LiveTrackingMap";
import { formatNaira } from "@/lib/client/format";

function DefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-text">{children}</dd>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { toast } = useToast();
  const { data: order, status, error, reload, setData } = useAdminData(
    () => adminGetOrder(id),
    [id],
  );

  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteOrder = useCallback(async () => {
    setWorking(true);
    try {
      await adminDeleteOrder(id);
      toast({ tone: "success", title: "Order deleted" });
      router.replace("/admin/orders");
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't delete", description: errorMessage(e) });
      setWorking(false);
    }
  }, [id, router, toast]);

  const applyStatus = useCallback(
    async (next: OrderStatus) => {
      setWorking(true);
      try {
        const updated = await adminSetOrderStatus(id, next);
        setData(updated);
        toast({ tone: "success", title: `Order ${ORDER_STATUS_LABEL[next].toLowerCase()}` });
      } catch (e) {
        const code = errorCode(e);
        if (code === "CONFLICT") {
          await reload(true);
          toast({
            tone: "warning",
            title: "This order was just updated",
            description: "Showing the current state - review and try again.",
          });
        } else if (code === "INVALID_TRANSITION") {
          await reload(true);
          toast({ tone: "warning", title: "That status change isn't allowed anymore" });
        } else {
          toast({ tone: "danger", title: "Couldn't update", description: errorMessage(e) });
        }
      } finally {
        setWorking(false);
        setPendingStatus(null);
      }
    },
    [id, setData, reload, toast],
  );

  // Riders only matter for delivery orders — fetched regardless (it's a
  // short list) rather than threading a conditional fetch through the hook.
  const { data: riders } = useAdminData(() => adminGetRiders(), []);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const assignRider = useCallback(
    async (riderId: string | null) => {
      setAssigning(true);
      try {
        const updated = await adminAssignRider(id, riderId);
        setData(updated);
        toast({ tone: "success", title: riderId ? "Rider assigned" : "Rider unassigned" });
        setSelectedRiderId("");
      } catch (e) {
        toast({ tone: "danger", title: "Couldn't update rider", description: errorMessage(e) });
      } finally {
        setAssigning(false);
      }
    },
    [id, setData, toast],
  );

  // Re-poll the order while a rider is actively assigned, so their live
  // position (order.rider.lastLat/lastLng) keeps updating on screen —
  // same idea as the customer tracking page's poll, just reusing the
  // existing reload() instead of a second endpoint.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const live = order?.fulfillmentType === "DELIVERY" && !!order?.riderId;
    if (pollRef.current) clearInterval(pollRef.current);
    if (!live) return;
    pollRef.current = setInterval(() => reload(true), 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [order?.fulfillmentType, order?.riderId, reload]);

  const notFound = isApiError(error) && (error.status === 404 || error.code === "NOT_FOUND");

  if (notFound) {
    return (
      <>
        <PageHeader title="Order" backHref="/admin/orders" backLabel="All orders" />
        <EmptyState title="Order not found" description="It may have been removed." />
      </>
    );
  }
  if (status === "error") {
    return (
      <>
        <PageHeader title="Order" backHref="/admin/orders" backLabel="All orders" />
        <ErrorState description={errorMessage(error)} onRetry={() => reload()} />
      </>
    );
  }
  if (status === "loading" || !order) {
    return <AdminPageSkeleton rows={6} />;
  }

  const nextStatuses = allowedNextStatuses(order.status, order.fulfillmentType);

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        description={`Placed ${formatDateTime(order.createdAt)}`}
        backHref="/admin/orders"
        backLabel="All orders"
        actions={
          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <Button
              size="sm"
              variant="quiet"
              icon={<Trash className="size-3.5" aria-hidden />}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-5">
          <Card className="p-4">
            <h2 className="mb-2 text-[13px] font-semibold text-text">Items</h2>
            <OrderLineItems
              items={order.items}
              subtotalKobo={order.subtotalKobo}
              deliveryFeeKobo={order.deliveryFeeKobo}
              totalKobo={order.totalKobo}
              fulfillmentType={order.fulfillmentType}
            />
            {order.notes ? (
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
                <span className="text-subtle">Kitchen notes: </span>
                {order.notes}
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <h2 className="mb-1 text-[13px] font-semibold text-text">Customer</h2>
            <dl className="divide-y divide-line">
              <DefRow label="Name">{order.customerName}</DefRow>
              <DefRow label="Phone">
                <span className="tnum font-mono">{order.customerPhone}</span>
              </DefRow>
              <DefRow label="Email">{order.customerEmail || "-"}</DefRow>
              <DefRow label="Account">{order.customerId ? "Registered" : "Guest"}</DefRow>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="mb-1 text-[13px] font-semibold text-text">
              {FULFILLMENT_LABEL[order.fulfillmentType]}
            </h2>
            <dl className="divide-y divide-line">
              {order.fulfillmentType === "DELIVERY" ? (
                <>
                  <DefRow label="Address">{order.deliveryAddress || "-"}</DefRow>
                  <DefRow label="Pin">
                    {order.deliveryLat && order.deliveryLng ? (
                      <a
                        className="tnum text-accent hover:underline"
                        href={`https://www.openstreetmap.org/?mlat=${order.deliveryLat}&mlon=${order.deliveryLng}#map=17/${order.deliveryLat}/${order.deliveryLng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {Number(order.deliveryLat).toFixed(5)}, {Number(order.deliveryLng).toFixed(5)}
                      </a>
                    ) : (
                      "-"
                    )}
                  </DefRow>
                  <DefRow label="Distance">
                    {order.deliveryDistanceKm ? `${Number(order.deliveryDistanceKm).toFixed(1)} km` : "-"}
                  </DefRow>
                </>
              ) : (
                <DefRow label="Method">Counter pickup</DefRow>
              )}
            </dl>
          </Card>

          {order.fulfillmentType === "DELIVERY" ? (
            <Card className="p-4">
              <h2 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-text">
                <Motorcycle className="size-4" aria-hidden />
                Rider
              </h2>

              {order.rider ? (
                <>
                  <dl className="divide-y divide-line">
                    <DefRow label="Name">{order.rider.name}</DefRow>
                    <DefRow label="Phone">
                      <span className="tnum font-mono">{order.rider.phone}</span>
                    </DefRow>
                  </dl>
                  {order.rider.lastLat && order.rider.lastLng && order.rider.lastSeenAt ? (
                    <div className="mt-3 space-y-2">
                      <LiveTrackingMap
                        riderPosition={
                          isRiderLocationFresh(new Date(order.rider.lastSeenAt))
                            ? { lat: Number(order.rider.lastLat), lng: Number(order.rider.lastLng) }
                            : null
                        }
                        destination={
                          order.deliveryLat && order.deliveryLng
                            ? { lat: Number(order.deliveryLat), lng: Number(order.deliveryLng) }
                            : null
                        }
                        className="h-56 w-full overflow-hidden rounded-lg border border-line-strong"
                      />
                      <p className="text-[12px] text-subtle">
                        {isRiderLocationFresh(new Date(order.rider.lastSeenAt))
                          ? `Live - updated ${relativeTime(order.rider.lastSeenAt)}`
                          : `Not currently sharing - last seen ${relativeTime(order.rider.lastSeenAt)}`}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[13px] text-muted">
                      Hasn&apos;t opened their tracking link yet.
                    </p>
                  )}
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    loading={assigning}
                    onClick={() => void assignRider(null)}
                  >
                    Unassign
                  </Button>
                </>
              ) : (
                <div className="mt-2 flex items-end gap-2">
                  <SelectField
                    label="Assign a rider"
                    containerClassName="flex-1"
                    value={selectedRiderId}
                    onChange={(e) => setSelectedRiderId(e.target.value)}
                  >
                    <option value="">Choose a rider…</option>
                    {(riders ?? [])
                      .filter((r) => r.isActive)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </SelectField>
                  <Button
                    size="sm"
                    disabled={!selectedRiderId}
                    loading={assigning}
                    onClick={() => void assignRider(selectedRiderId)}
                  >
                    Assign
                  </Button>
                </div>
              )}
              {(riders ?? []).length === 0 ? (
                <p className="mt-2 text-[12px] text-subtle">
                  No riders yet — add one under Riders in the sidebar.
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-4">
            <h2 className="mb-1 text-[13px] font-semibold text-text">Payment</h2>
            {order.payment ? (
              <dl className="divide-y divide-line">
                <DefRow label="Status">
                  <PaymentStatusBadge status={order.payment.status} />
                </DefRow>
                <DefRow label="Amount">{formatNaira(order.payment.amountKobo)}</DefRow>
                <DefRow label="Reference">
                  <span className="tnum font-mono text-[12px]">{order.payment.reference}</span>
                </DefRow>
                <DefRow label="Provider">{order.payment.provider}</DefRow>
                <DefRow label="Paid at">
                  {order.payment.paidAt ? formatDateTime(order.payment.paidAt) : "-"}
                </DefRow>
              </dl>
            ) : (
              <p className="py-2 text-[13px] text-muted">No payment initialised yet.</p>
            )}
          </Card>
        </div>

        {/* Status actions */}
        <Card className="p-4 lg:sticky lg:top-6">
          <h2 className="text-[13px] font-semibold text-text">Advance status</h2>
          <p className="mt-1 text-[12px] text-subtle">
            Current: {ORDER_STATUS_LABEL[order.status]}
          </p>
          {nextStatuses.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted">
              No further transitions from here.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "CANCELLED" ? "danger" : "primary"}
                  loading={working && pendingStatus === s}
                  disabled={working}
                  onClick={() =>
                    s === "CANCELLED" ? setPendingStatus(s) : void applyStatus(s)
                  }
                >
                  {TRANSITION_VERB[s]}
                </Button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog
        open={pendingStatus === "CANCELLED"}
        onClose={() => setPendingStatus(null)}
        title="Cancel this order?"
        description={`Order ${order.orderNumber} will be marked cancelled. If it was paid, arrange the refund separately.`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPendingStatus(null)}>
              Keep order
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={working}
              onClick={() => void applyStatus("CANCELLED")}
            >
              Cancel order
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">This can&apos;t be undone from here.</p>
      </Dialog>

      <Dialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this order?"
        description="This removes it from your dashboard — the order record and its payment history are kept, not erased."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={working} onClick={() => void deleteOrder()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">You won&apos;t see it here again.</p>
      </Dialog>
    </>
  );
}
