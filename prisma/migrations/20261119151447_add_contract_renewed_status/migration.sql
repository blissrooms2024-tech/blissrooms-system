-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'RENEWED';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "renewedFromContractId" TEXT;
