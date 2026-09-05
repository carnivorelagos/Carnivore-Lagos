-- Hand-written to match schema.prisma (same process as the initial
-- migration — see DEPLOYMENT.md "A note on how this schema was
-- validated"). A normal environment can regenerate this with
-- `prisma migrate dev`; `prisma migrate deploy` applies it as-is.

-- CreateEnum
CREATE TYPE "PaymentIssueType" AS ENUM ('AMOUNT_MISMATCH', 'ORPHAN_CHARGE', 'STUCK_PENDING', 'PAID_ORDER_NOT_ADVANCED');

-- CreateEnum
CREATE TYPE "PaymentIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "PaymentIssue" (
    "id" TEXT NOT NULL,
    "type" "PaymentIssueType" NOT NULL,
    "status" "PaymentIssueStatus" NOT NULL DEFAULT 'OPEN',
    "reference" TEXT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "expectedKobo" INTEGER,
    "observedKobo" INTEGER,
    "currency" TEXT,
    "detail" TEXT NOT NULL,
    "context" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIssue_type_reference_key" ON "PaymentIssue"("type", "reference");

-- CreateIndex
CREATE INDEX "PaymentIssue_status_idx" ON "PaymentIssue"("status");

-- CreateIndex
CREATE INDEX "PaymentIssue_reference_idx" ON "PaymentIssue"("reference");

-- CreateIndex
CREATE INDEX "PaymentIssue_createdAt_idx" ON "PaymentIssue"("createdAt");
