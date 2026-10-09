-- Riders the restaurant onboards directly for delivery (not a platform
-- courier) — tracked by a single unguessable link (Rider.token) rather
-- than a login, mirroring Order.trackingSlug.
CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLat" DECIMAL(9,6),
    "lastLng" DECIMAL(9,6),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Rider_token_key" ON "Rider"("token");
CREATE INDEX "Rider_isActive_idx" ON "Rider"("isActive");

-- Which rider (if any) is delivering this order.
ALTER TABLE "Order" ADD COLUMN "riderId" TEXT;
CREATE INDEX "Order_riderId_idx" ON "Order"("riderId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
