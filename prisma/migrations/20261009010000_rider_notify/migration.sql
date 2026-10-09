-- A rider's email (optional) so a new assignment can be emailed to them
-- alongside / instead of web push.
ALTER TABLE "Rider" ADD COLUMN "email" TEXT;

-- Web Push subscriptions for riders, mirroring PushSubscription /
-- AdminPushSubscription.
CREATE TABLE "RiderPushSubscription" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RiderPushSubscription_endpoint_key" ON "RiderPushSubscription"("endpoint");
CREATE INDEX "RiderPushSubscription_riderId_idx" ON "RiderPushSubscription"("riderId");

ALTER TABLE "RiderPushSubscription" ADD CONSTRAINT "RiderPushSubscription_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
