-- Hand-written to match schema.prisma (same process as earlier migrations
-- — see DEPLOYMENT.md). `prisma migrate deploy` applies it as-is.
--
-- Covers the device-history amendment set:
--   1. Order.trackingSlug — unguessable public identifier for all lookups.
--   2. Order.deviceProfileId — no-login order ownership.
--   3. DeviceProfile — per-device identity: history, saved Paystack card
--      authorization, optional verified contact email.
--   4. ContactVerification — passwordless email magic link for "secure
--      your order history".

-- CreateTable
CREATE TABLE "DeviceProfile" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "verifiedContactEmail" TEXT,
    "paystackAuthorizationCode" TEXT,
    "paystackAuthEmail" TEXT,
    "paystackCardLast4" TEXT,
    "paystackCardBrand" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactVerification" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceProfileId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProfile_token_key" ON "DeviceProfile"("token");
CREATE INDEX "DeviceProfile_verifiedContactEmail_idx" ON "DeviceProfile"("verifiedContactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ContactVerification_tokenHash_key" ON "ContactVerification"("tokenHash");
CREATE INDEX "ContactVerification_deviceProfileId_idx" ON "ContactVerification"("deviceProfileId");

-- AddForeignKey
ALTER TABLE "ContactVerification" ADD CONSTRAINT "ContactVerification_deviceProfileId_fkey" FOREIGN KEY ("deviceProfileId") REFERENCES "DeviceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Order.trackingSlug. Added nullable, backfilled, then made
-- NOT NULL so the migration is safe even if rows exist at deploy time.
ALTER TABLE "Order" ADD COLUMN "trackingSlug" TEXT;
UPDATE "Order" SET "trackingSlug" = replace(gen_random_uuid()::text, '-', '') WHERE "trackingSlug" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "trackingSlug" SET NOT NULL;

-- AlterTable: Order.deviceProfileId
ALTER TABLE "Order" ADD COLUMN "deviceProfileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_trackingSlug_key" ON "Order"("trackingSlug");
CREATE INDEX "Order_deviceProfileId_idx" ON "Order"("deviceProfileId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deviceProfileId_fkey" FOREIGN KEY ("deviceProfileId") REFERENCES "DeviceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
