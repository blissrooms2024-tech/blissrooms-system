-- 待办: staff to-dos with morning email reminders.
CREATE TABLE "Todo" (
    "id" TEXT NOT NULL,
    "todoCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "doneAt" TIMESTAMP(3),
    "doneByName" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Todo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Todo_todoCode_key" ON "Todo"("todoCode");
CREATE INDEX "Todo_ownerId_status_idx" ON "Todo"("ownerId", "status");
CREATE INDEX "Todo_status_dueDate_idx" ON "Todo"("status", "dueDate");

ALTER TABLE "Todo" ADD CONSTRAINT "Todo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
