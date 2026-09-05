-- Hand-written to match schema.prisma (same process as earlier migrations
-- — see DEPLOYMENT.md). `prisma migrate deploy` applies it as-is.
-- Covers: delivery lifecycle statuses, notification history + web push,
-- and the menu `tags` column the smart search / concierge needs.

-- AlterEnum: OrderStatus gains the delivery leg. New values are added
-- before COMPLETED for readable ordering. PG12+ allows ADD VALUE inside a
-- transaction as long as the value isn't *used* in the same transaction
-- (it isn't here). If `prisma migrate deploy` ever rejects this, run
-- these two lines manually against DIRECT_URL first, then re-run deploy.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY' BEFORE 'COMPLETED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED' BEFORE 'COMPLETED';

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'PAYMENT_CONFIRMED',
  'ORDER_CONFIRMED',
  'ORDER_PREPARING',
  'ORDER_READY',
  'ORDER_OUT_FOR_DELIVERY',
  'ORDER_DELIVERED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED'
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "orderUpdatesOptOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN "autoConfirmPaidOrders" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_orderId_type_key" ON "Notification"("orderId", "type");
CREATE INDEX "Notification_customerId_createdAt_idx" ON "Notification"("customerId", "createdAt");
CREATE INDEX "Notification_customerId_readAt_idx" ON "Notification"("customerId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_customerId_idx" ON "PushSubscription"("customerId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
