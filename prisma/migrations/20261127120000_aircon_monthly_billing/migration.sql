-- AlterTable
ALTER TABLE "UtilityMeter" ADD COLUMN     "startPeriod" TEXT;

-- AlterTable
ALTER TABLE "UtilityBillRun" ADD COLUMN     "creditAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UtilityCredit" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT NOT NULL,
    "runId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UtilityCredit_contractId_idx" ON "UtilityCredit"("contractId");

-- CreateIndex
CREATE INDEX "UtilityCredit_runId_idx" ON "UtilityCredit"("runId");

-- AddForeignKey
ALTER TABLE "UtilityCredit" ADD CONSTRAINT "UtilityCredit_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityCredit" ADD CONSTRAINT "UtilityCredit_runId_fkey" FOREIGN KEY ("runId") REFERENCES "UtilityBillRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
