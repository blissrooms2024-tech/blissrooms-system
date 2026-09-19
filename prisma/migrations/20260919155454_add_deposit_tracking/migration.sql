-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "ownerDeposit" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "securityDeposit" DECIMAL(10,2) NOT NULL DEFAULT 0;
