-- 注意事项: notes per unit, and per condo / apartment building (shared by its units).
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Building_name_key" ON "Building"("name");

ALTER TABLE "Property" ADD COLUMN "buildingId" TEXT;
ALTER TABLE "Property" ADD CONSTRAINT "Property_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PropertyNote" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "buildingId" TEXT,
    "text" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PropertyNote_propertyId_idx" ON "PropertyNote"("propertyId");
CREATE INDEX "PropertyNote_buildingId_idx" ON "PropertyNote"("buildingId");
ALTER TABLE "PropertyNote" ADD CONSTRAINT "PropertyNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyNote" ADD CONSTRAINT "PropertyNote_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every unit starts in a building named after it; units with the same name share one.
INSERT INTO "Building" ("id", "name")
SELECT 'bld_' || md5(btrim("name")), btrim("name")
FROM "Property"
WHERE btrim(coalesce("name", '')) <> ''
GROUP BY btrim("name");

UPDATE "Property" p SET "buildingId" = b."id" FROM "Building" b WHERE b."name" = btrim(p."name");

-- What was already written down carries over (the old columns are left untouched):
-- the unit's 备注 becomes a note on that unit…
INSERT INTO "PropertyNote" ("id", "propertyId", "text", "createdByName", "updatedAt")
SELECT 'pn_' || md5(p."id" || ':notes'), p."id", btrim(p."notes"), '原本的备注', CURRENT_TIMESTAMP
FROM "Property" p
WHERE btrim(coalesce(p."notes", '')) <> '';

-- …and the building's renovation / moving rules become a note on its building.
INSERT INTO "PropertyNote" ("id", "propertyId", "buildingId", "text", "createdByName", "updatedAt")
SELECT 'pn_' || md5(i."propertyId" || ':rules'),
       CASE WHEN p."buildingId" IS NULL THEN p."id" END,
       p."buildingId",
       btrim(i."buildingRules"),
       '原本的装修 / 搬家规定',
       CURRENT_TIMESTAMP
FROM "PropertyInfo" i
JOIN "Property" p ON p."id" = i."propertyId"
WHERE btrim(coalesce(i."buildingRules", '')) <> '';
