-- Admin "delete order" (soft). See the comment on Order.deletedAt in
-- schema.prisma for why this is soft, not a hard delete.
ALTER TABLE "Order" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Order_deletedAt_idx" ON "Order"("deletedAt");
