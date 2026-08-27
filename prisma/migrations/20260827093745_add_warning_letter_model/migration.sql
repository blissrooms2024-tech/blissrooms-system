-- CreateTable
CREATE TABLE "WarningLetter" (
    "id" TEXT NOT NULL,
    "letterCode" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarningLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarningLetter_letterCode_key" ON "WarningLetter"("letterCode");

-- CreateIndex
CREATE INDEX "WarningLetter_contractId_idx" ON "WarningLetter"("contractId");

-- AddForeignKey
ALTER TABLE "WarningLetter" ADD CONSTRAINT "WarningLetter_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
