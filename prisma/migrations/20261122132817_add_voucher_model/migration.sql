-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "voucherCode" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "imageUrl" TEXT,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_voucherCode_key" ON "Voucher"("voucherCode");

-- CreateIndex
CREATE INDEX "Voucher_contractId_idx" ON "Voucher"("contractId");

-- CreateIndex
CREATE INDEX "Voucher_tenantId_idx" ON "Voucher"("tenantId");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
