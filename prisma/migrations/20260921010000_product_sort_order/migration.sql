-- Manual display order within a category — see the comment on
-- Product.sortOrder in schema.prisma.
ALTER TABLE "Product" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "Product_categoryId_idx";
CREATE INDEX "Product_categoryId_sortOrder_idx" ON "Product"("categoryId", "sortOrder");
