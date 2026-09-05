import {
  CheckCircle,
  Clock,
  CookingPot,
  Fire,
  Package,
  Prohibit,
  Truck,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/client/cn";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
} from "@/lib/client/format";
import type { OrderStatus, PaymentStatus } from "@/lib/client/types";

type Tone = "neutral" | "pending" | "progress" | "positive" | "done" | "cancelled";

const TONE_CLASS: Record<Tone, string> = {
  neutral:
    "border-[var(--color-line-strong)] bg-[color-mix(in_oklab,var(--color-muted)_10%,transparent)] text-[var(--color-muted)]",
  pending:
    "border-[color-mix(in_oklab,var(--color-warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]",
  progress:
    "border-[color-mix(in_oklab,var(--color-gold)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-gold)_15%,transparent)] text-[var(--color-gold)]",
  positive:
    "border-[color-mix(in_oklab,var(--color-success)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-success)_15%,transparent)] text-[var(--color-success)]",
  done:
    "border-[var(--color-line-strong)] bg-[color-mix(in_oklab,var(--color-muted)_14%,transparent)] text-[var(--color-text)]",
  cancelled:
    "border-[color-mix(in_oklab,var(--color-danger)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]",
};

export function Badge({
  children,
  tone = "neutral",
  icon: IconEl,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: Icon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium leading-none",
        TONE_CLASS[tone],
        className,
      )}
    >
      {IconEl ? <IconEl weight="fill" className="size-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

const STATUS_ICON: Record<OrderStatus, Icon> = {
  PENDING_PAYMENT: Clock,
  PAID: CheckCircle,
  CONFIRMED: CheckCircle,
  PREPARING: CookingPot,
  READY: Package,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: CheckCircle,
  COMPLETED: Fire,
  CANCELLED: Prohibit,
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} icon={STATUS_ICON[status]} className={className}>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  PENDING: "pending",
  SUCCESS: "positive",
  FAILED: "cancelled",
};
const PAYMENT_ICON: Record<PaymentStatus, Icon> = {
  PENDING: Clock,
  SUCCESS: CheckCircle,
  FAILED: XCircle,
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <Badge tone={PAYMENT_TONE[status]} icon={PAYMENT_ICON[status]} className={className}>
      {PAYMENT_STATUS_LABEL[status]}
    </Badge>
  );
}
