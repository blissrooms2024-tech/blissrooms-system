-- CreateEnum
CREATE TYPE "MaintenanceWorkerType" AS ENUM ('IN_HOUSE', 'OUTSOURCED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'WORKER';

-- AlterTable
ALTER TABLE "MaintenanceRequest" ADD COLUMN     "assignedWorkerId" TEXT,
ADD COLUMN     "cost" DECIMAL(10,2),
ADD COLUMN     "costPaidAt" TIMESTAMP(3),
ADD COLUMN     "invoiceUrl" TEXT,
ADD COLUMN     "workerAfterPhotos" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "workerBeforePhotos" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "workerType" "MaintenanceWorkerType";

-- CreateIndex
CREATE INDEX "MaintenanceRequest_assignedWorkerId_idx" ON "MaintenanceRequest"("assignedWorkerId");
