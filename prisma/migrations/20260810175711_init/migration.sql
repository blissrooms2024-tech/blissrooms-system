-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BOSS', 'ADMIN', 'AGENT', 'TENANT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('VACANT', 'OCCUPIED', 'RESERVED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVE', 'PENDING_SIGN', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'MOVED_OUT');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'UTILITIES', 'RENTAL', 'ADMIN_FEE', 'ACCESS_CARD', 'AC', 'LATE_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "MoveType" AS ENUM ('MOVE_IN', 'MOVE_OUT');

-- CreateTable
CREATE TABLE "Counter" (
    "prefix" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("prefix")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "ic" TEXT,
    "commRate" DECIMAL(6,4),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "resetToken" TEXT,
    "resetExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "propertyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "region" TEXT,
    "landlord" TEXT,
    "status" TEXT DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "propertyId" TEXT,
    "propertyName" TEXT NOT NULL,
    "roomType" TEXT,
    "roomRental" DECIMAL(10,2) NOT NULL,
    "carparkRental" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "RoomStatus" NOT NULL DEFAULT 'VACANT',
    "currentTenantId" TEXT,
    "currentContractId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractCode" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "propertyAddress" TEXT,
    "tenantId" TEXT,
    "tenantName" TEXT NOT NULL,
    "tenantIc" TEXT,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "moveInDate" TIMESTAMP(3),
    "commencementDate" TIMESTAMP(3),
    "expiredDate" TIMESTAMP(3),
    "tenureMonths" INTEGER,
    "roomRental" DECIMAL(10,2) NOT NULL,
    "carparkRental" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "securityDeposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "utilitiesDeposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "earnestDeposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "accessCardDeposit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adminFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalOutstanding" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "agentSignature" TEXT,
    "agentSignDate" TIMESTAMP(3),
    "tenantSignature" TEXT,
    "tenantSignDate" TIMESTAMP(3),
    "commAmount" DECIMAL(10,2),
    "commStatus" TEXT DEFAULT 'Pending',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "autoDeleteAt" TIMESTAMP(3),
    "pdfLink" TEXT,
    "remarks" TEXT,
    "nationality" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "occupation" TEXT,
    "company" TEXT,
    "carPlate" TEXT,
    "emergencyName" TEXT,
    "emergencyContact" TEXT,
    "emergencyRelationship" TEXT,
    "utilDryer" BOOLEAN NOT NULL DEFAULT false,
    "utilAircond" BOOLEAN NOT NULL DEFAULT false,
    "utilElectric" BOOLEAN NOT NULL DEFAULT false,
    "icFront" TEXT,
    "icBack" TEXT,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentCode" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT,
    "periodMonth" TEXT,
    "type" "PaymentType" NOT NULL,
    "amountDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Paid',
    "method" TEXT,
    "receiptLink" TEXT,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "commCode" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "saleAmount" DECIMAL(10,2) NOT NULL,
    "commRate" DECIMAL(6,4) NOT NULL,
    "commAmount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "approvedBy" TEXT,
    "paidDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoveInOutForm" (
    "id" TEXT NOT NULL,
    "formCode" TEXT NOT NULL,
    "type" "MoveType" NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT,
    "roomCode" TEXT NOT NULL,
    "moveInDate" TIMESTAMP(3),
    "formDate" TIMESTAMP(3),
    "photos" JSONB NOT NULL DEFAULT '{}',
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "remarks" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "MoveInOutForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "logCode" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "toEmail" TEXT,
    "subject" TEXT,
    "status" TEXT,
    "relatedId" TEXT,
    "triggeredBy" TEXT,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userCode_key" ON "User"("userCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Property_propertyCode_key" ON "Property"("propertyCode");

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomCode_key" ON "Room"("roomCode");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractCode_key" ON "Contract"("contractCode");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_agentId_idx" ON "Contract"("agentId");

-- CreateIndex
CREATE INDEX "Contract_tenantId_idx" ON "Contract"("tenantId");

-- CreateIndex
CREATE INDEX "Contract_roomId_idx" ON "Contract"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentCode_key" ON "Payment"("paymentCode");

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_commCode_key" ON "Commission"("commCode");

-- CreateIndex
CREATE INDEX "Commission_agentId_idx" ON "Commission"("agentId");

-- CreateIndex
CREATE INDEX "Commission_contractId_idx" ON "Commission"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "MoveInOutForm_formCode_key" ON "MoveInOutForm"("formCode");

-- CreateIndex
CREATE INDEX "MoveInOutForm_contractId_type_idx" ON "MoveInOutForm"("contractId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Log_logCode_key" ON "Log"("logCode");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_currentTenantId_fkey" FOREIGN KEY ("currentTenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveInOutForm" ADD CONSTRAINT "MoveInOutForm_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveInOutForm" ADD CONSTRAINT "MoveInOutForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
