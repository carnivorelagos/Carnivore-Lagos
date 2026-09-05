import { Check, Circle, Prohibit } from "@phosphor-icons/react/dist/ssr";
import { ORDER_STATUS_LABEL, orderTimelineFor } from "@/lib/client/format";
import type { FulfillmentType, OrderStatus } from "@/lib/client/types";
import { cn } from "@/lib/client/cn";

/**
 * Customer-facing progress tracker (Section 25). Shape + icon + weight
 * carry the state, not colour alone. The step sequence branches on
 * fulfilment: delivery orders show OUT_FOR_DELIVERY -> DELIVERED where
 * pickup orders show COMPLETED.
 */
export function OrderTimeline({
  status,
  fulfillmentType = "PICKUP",
}: {
  status: OrderStatus;
  fulfillmentType?: FulfillmentType;
}) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-danger)_8%,transparent)] px-4 py-3">
        <Prohibit className="size-5 text-[var(--color-danger)]" weight="fill" aria-hidden />
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">Order cancelled</p>
          <p className="text-[12.5px] text-[var(--color-muted)]">
            If you were charged, a refund follows to your payment method.
          </p>
        </div>
      </div>
    );
  }

  const steps = orderTimelineFor(fulfillmentType);
  const currentIndex = steps.indexOf(status);

  const caption = (step: OrderStatus): string => {
    switch (step) {
      case "PENDING_PAYMENT":
        return "Waiting for payment to complete.";
      case "PAID":
        return "Payment received. The kitchen will confirm shortly.";
      case "CONFIRMED":
        return "Confirmed by the kitchen.";
      case "PREPARING":
        return "On the grill now.";
      case "READY":
        return fulfillmentType === "DELIVERY" ? "Ready and waiting for a rider." : "Ready for pickup.";
      case "OUT_FOR_DELIVERY":
        return "On its way to you.";
      case "DELIVERED":
        return "Delivered. Enjoy!";
      default:
        return "All done. Enjoy.";
    }
  };

  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const last = i === steps.length - 1;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border",
                  done && "border-[var(--color-success)] bg-[var(--color-success)] text-white",
                  current &&
                    "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]",
                  !done && !current && "border-[var(--color-line-strong)] text-[var(--color-subtle)]",
                )}
              >
                {done ? (
                  <Check className="size-3.5" weight="bold" aria-hidden />
                ) : current ? (
                  <span className="size-2 rounded-full bg-current" aria-hidden />
                ) : (
                  <Circle className="size-2.5" weight="fill" aria-hidden />
                )}
              </span>
              {!last ? (
                <span
                  className={cn(
                    "my-1 w-px flex-1",
                    i < currentIndex ? "bg-[var(--color-success)]" : "bg-[var(--color-line)]",
                  )}
                />
              ) : null}
            </div>
            <div className={cn("pb-6", last && "pb-0")}>
              <p
                className={cn(
                  "text-sm",
                  current
                    ? "font-medium text-[var(--color-text)]"
                    : done
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-subtle)]",
                )}
              >
                {ORDER_STATUS_LABEL[step]}
              </p>
              {current ? (
                <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{caption(step)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
