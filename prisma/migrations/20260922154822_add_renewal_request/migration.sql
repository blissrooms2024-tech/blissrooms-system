-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "renewalRequestedAt" TIMESTAMP(3),
ADD COLUMN     "renewalRequestedMonths" INTEGER;
