-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "assignedTo" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_requestCode_key" ON "MaintenanceRequest"("requestCode");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_contractId_idx" ON "MaintenanceRequest"("contractId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_idx" ON "MaintenanceRequest"("status");

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
