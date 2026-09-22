-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
