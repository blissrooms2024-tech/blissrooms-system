-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'SUPPLIES';
ALTER TYPE "ExpenseCategory" ADD VALUE 'FURNITURE';
ALTER TYPE "ExpenseCategory" ADD VALUE 'TRANSPORT';
ALTER TYPE "ExpenseCategory" ADD VALUE 'ADVERTISING';
ALTER TYPE "ExpenseCategory" ADD VALUE 'OFFICE';

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_propertyId_fkey";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "roomId" TEXT,
ALTER COLUMN "propertyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "claimCode" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "propertyId" TEXT,
    "roomId" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "customLabel" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "notes" TEXT,
    "receipts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "expenseId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidRef" TEXT,
    "paidSlip" TEXT,
    "paidById" TEXT,
    "paidByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_claimCode_key" ON "ExpenseClaim"("claimCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_expenseId_key" ON "ExpenseClaim"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");

-- CreateIndex
CREATE INDEX "ExpenseClaim_submittedById_idx" ON "ExpenseClaim"("submittedById");

-- CreateIndex
CREATE INDEX "ExpenseClaim_propertyId_idx" ON "ExpenseClaim"("propertyId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
