-- CreateTable
CREATE TABLE "PropertyInfo" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitNo" TEXT,
    "sizeSqft" INTEGER,
    "bathrooms" INTEGER,
    "parkingBays" INTEGER,
    "parkingLotNos" TEXT,
    "airconCount" INTEGER,
    "waterHeaterCount" INTEGER,
    "furnishing" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wifiName" TEXT,
    "wifiPassword" TEXT,
    "routerLogin" TEXT,
    "smartLockPassword" TEXT,
    "mailboxNo" TEXT,
    "mailboxPassword" TEXT,
    "mgmtContactName" TEXT,
    "mgmtOfficePhone" TEXT,
    "guardhousePhone" TEXT,
    "visitorApp" TEXT,
    "buildingRules" TEXT,
    "ownerPhone" TEXT,
    "ownerBank" TEXT,
    "ownerLeaseStart" TIMESTAMP(3),
    "ownerLeaseEnd" TIMESTAMP(3),
    "ownerRentDueDay" INTEGER,
    "renewalNoticeDays" INTEGER,
    "appliances" TEXT,
    "airconLastServiced" TIMESTAMP(3),
    "fireExtinguisherExpiry" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PropertyInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCard" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "serialNo" TEXT,
    "holder" TEXT NOT NULL DEFAULT 'OFFICE',
    "roomId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SPARE',
    "deposit" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityAccount" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "utilityType" TEXT NOT NULL,
    "provider" TEXT,
    "accountNo" TEXT,
    "accountHolder" TEXT,
    "payTo" TEXT NOT NULL DEFAULT 'PROVIDER',
    "fixedAmount" DECIMAL(10,2),
    "dueDay" INTEGER,
    "autoDebit" BOOLEAN NOT NULL DEFAULT false,
    "meterNo" TEXT,
    "contractEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilityAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyInfo_propertyId_key" ON "PropertyInfo"("propertyId");

-- CreateIndex
CREATE INDEX "AccessCard_propertyId_idx" ON "AccessCard"("propertyId");

-- CreateIndex
CREATE INDEX "UtilityAccount_propertyId_idx" ON "UtilityAccount"("propertyId");

-- AddForeignKey
ALTER TABLE "PropertyInfo" ADD CONSTRAINT "PropertyInfo_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCard" ADD CONSTRAINT "AccessCard_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCard" ADD CONSTRAINT "AccessCard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityAccount" ADD CONSTRAINT "UtilityAccount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
