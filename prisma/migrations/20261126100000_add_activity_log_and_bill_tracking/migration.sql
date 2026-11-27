-- AlterTable
ALTER TABLE "PropertyInfo" ADD COLUMN     "ownerRentPaidPeriod" TEXT;

-- AlterTable
ALTER TABLE "UtilityAccount" ADD COLUMN     "lastPaidPeriod" TEXT;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "role" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "target" TEXT,
    "summary" TEXT NOT NULL,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");
