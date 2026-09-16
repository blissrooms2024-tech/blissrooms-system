-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "carparkRoomId" TEXT;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_carparkRoomId_fkey" FOREIGN KEY ("carparkRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
