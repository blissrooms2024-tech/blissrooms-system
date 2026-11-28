-- Furniture a room has, as confirmed by management after renovation. Add-only.
ALTER TABLE "Room" ADD COLUMN "furniture" JSONB;
ALTER TABLE "Room" ADD COLUMN "furnitureConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Room" ADD COLUMN "furnitureConfirmedBy" TEXT;
