-- What a claim's receipt says, read off the photo (shop, receipt no., total). Add-only.
ALTER TABLE "ExpenseClaim" ADD COLUMN "merchant" TEXT;
ALTER TABLE "ExpenseClaim" ADD COLUMN "receiptNo" TEXT;
ALTER TABLE "ExpenseClaim" ADD COLUMN "receiptAmount" DECIMAL(10,2);

CREATE INDEX "ExpenseClaim_receiptNo_idx" ON "ExpenseClaim"("receiptNo");
