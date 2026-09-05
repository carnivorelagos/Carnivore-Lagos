import { Money } from "@/components/ui/Money";
import { formatNaira } from "@/lib/client/format";
import type { FulfillmentType } from "@/lib/client/types";

type Line = {
  productNameSnapshot: string;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
};

/** Receipt-style item list + totals, shared by every order view. */
export function OrderLineItems({
  items,
  subtotalKobo,
  deliveryFeeKobo,
  totalKobo,
  fulfillmentType,
}: {
  items: Line[];
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  fulfillmentType: FulfillmentType;
}) {
  return (
    <div>
      <ul className="divide-y divide-[var(--color-line)]">
        {items.map((li, i) => (
          <li key={`${li.productNameSnapshot}-${i}`} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-text)]">
                <span className="tnum text-[var(--color-subtle)]">{li.quantity}× </span>
                {li.productNameSnapshot}
              </p>
              <p className="text-[12px] text-[var(--color-subtle)]">
                {formatNaira(li.unitPriceKobo)} each
              </p>
            </div>
            <Money kobo={li.lineTotalKobo} size="sm" />
          </li>
        ))}
      </ul>

      <dl className="mt-3 space-y-2 border-t border-[var(--color-line)] pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Subtotal</dt>
          <dd>
            <Money kobo={subtotalKobo} size="sm" />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">
            {fulfillmentType === "DELIVERY" ? "Delivery fee" : "Pickup"}
          </dt>
          <dd>
            {fulfillmentType === "DELIVERY" ? (
              <Money kobo={deliveryFeeKobo} size="sm" />
            ) : (
              <span className="text-[var(--color-muted)]">Free</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between border-t border-[var(--color-line)] pt-2 text-[var(--color-text)]">
          <dt className="font-medium">Total</dt>
          <dd>
            <Money kobo={totalKobo} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
