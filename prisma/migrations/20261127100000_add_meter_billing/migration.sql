-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "occupants" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "utilityRunId" TEXT;

-- CreateTable
CREATE TABLE "UtilityMeter" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "roomId" TEXT,
    "label" TEXT,
    "meterNo" TEXT,
    "inputMode" TEXT NOT NULL DEFAULT 'READING',
    "startReading" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "previous" DECIMAL(12,2),
    "reading" DECIMAL(12,2),
    "usage" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "photoUrl" TEXT,
    "runId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityExemption" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityExemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityBillRun" (
    "id" TEXT NOT NULL,
    "runCode" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "splitBy" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "billedAmount" DECIMAL(10,2) NOT NULL,
    "companyAmount" DECIMAL(10,2) NOT NULL,
    "details" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityBillRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "UtilityMeter_propertyId_idx" ON "UtilityMeter"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_meterId_period_key" ON "MeterReading"("meterId", "period");

-- CreateIndex
CREATE INDEX "UtilityExemption_contractId_idx" ON "UtilityExemption"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityBillRun_runCode_key" ON "UtilityBillRun"("runCode");

-- CreateIndex
CREATE UNIQUE INDEX "UtilityBillRun_propertyId_period_key" ON "UtilityBillRun"("propertyId", "period");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_utilityRunId_fkey" FOREIGN KEY ("utilityRunId") REFERENCES "UtilityBillRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityMeter" ADD CONSTRAINT "UtilityMeter_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityMeter" ADD CONSTRAINT "UtilityMeter_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "UtilityMeter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_runId_fkey" FOREIGN KEY ("runId") REFERENCES "UtilityBillRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityExemption" ADD CONSTRAINT "UtilityExemption_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityBillRun" ADD CONSTRAINT "UtilityBillRun_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
