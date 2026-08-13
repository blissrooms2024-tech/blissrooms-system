-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "relatedPaymentId" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "hasAircon" BOOLEAN NOT NULL DEFAULT false;
