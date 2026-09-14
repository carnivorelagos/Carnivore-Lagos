-- Hand-written to match schema.prisma (same process as earlier migrations
-- — see DEPLOYMENT.md). `prisma migrate deploy` applies it as-is.
--
-- Admin Web Push subscriptions — real-time "new paid order" alerts for
-- the kitchen (src/lib/webPush.ts sendWebPushToAdmins).

-- CreateTable
CREATE TABLE "AdminPushSubscription" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminPushSubscription_endpoint_key" ON "AdminPushSubscription"("endpoint");
CREATE INDEX "AdminPushSubscription_adminUserId_idx" ON "AdminPushSubscription"("adminUserId");

-- AddForeignKey
ALTER TABLE "AdminPushSubscription" ADD CONSTRAINT "AdminPushSubscription_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
