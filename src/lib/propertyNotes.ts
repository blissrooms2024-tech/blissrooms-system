import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

/** 注意事项 — things to keep in mind about a unit, or about the whole condo / apartment it's in
 * (every unit in that building shows those). Boss / Admin write them; Boss, Admin and Agents read
 * them on the unit, room and contract pages. */

export const canReadNotes = (s: Pick<SessionPayload, "role">) => ["BOSS", "ADMIN", "AGENT"].includes(s.role);
export const canEditNotes = (s: Pick<SessionPayload, "role">) => s.role === "BOSS" || s.role === "ADMIN";

/** "  Pixel   City " → "Pixel City" */
export const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");

const noteSelect = { id: true, text: true, createdByName: true, updatedByName: true, createdAt: true, updatedAt: true } as const;
type NoteRow = { id: string; text: string; createdByName: string; updatedByName: string | null; createdAt: Date; updatedAt: Date };
const noteView = (n: NoteRow) => ({
  id: n.id,
  text: n.text,
  /** Whoever wrote it last. */
  by: n.updatedByName ?? n.createdByName,
  at: (n.updatedByName ? n.updatedAt : n.createdAt).toISOString(),
});
export type NoteView = ReturnType<typeof noteView>;

/** A unit's notes, its building's notes, and which units share that building. */
export async function notesForUnit(propertyCode: string) {
  const p = await prisma.property.findUnique({
    where: { propertyCode },
    select: {
      id: true,
      propertyCode: true,
      name: true,
      buildingId: true,
      building: {
        select: {
          id: true,
          name: true,
          units: { select: { propertyCode: true, name: true }, orderBy: { propertyCode: "asc" } },
          notes: { select: noteSelect, orderBy: { createdAt: "asc" } },
        },
      },
      propertyNotes: { select: noteSelect, orderBy: { createdAt: "asc" } },
    },
  });
  if (!p) return null;
  return {
    propertyId: p.id,
    unit: { code: p.propertyCode, name: p.name },
    building: p.building ? { id: p.building.id, name: p.building.name, units: p.building.units.map((u) => ({ code: u.propertyCode, name: u.name })) } : null,
    buildingNotes: p.building?.notes.map(noteView) ?? [],
    unitNotes: p.propertyNotes.map(noteView),
  };
}

/** Every building, for picking which one a unit is in. */
export async function buildingChoices() {
  const rows = await prisma.building.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { units: true } } } });
  return rows.map((b) => ({ id: b.id, name: b.name, units: b._count.units }));
}

/**
 * Put a unit in the condo / apartment with this name (made if nobody uses the name yet).
 * The only unit in its building, given a name nobody uses, just renames that building; a
 * building left with no units hands its notes to the new one, so nothing written down is lost.
 */
export async function setUnitBuilding(propertyId: string, rawName: string): Promise<{ name: string; changed: boolean; movedNotes: number }> {
  const name = cleanName(rawName);
  const p = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, buildingId: true, building: { select: { id: true, _count: { select: { units: true } } } } },
  });
  if (!p) throw new Error("unit not found");
  const existing = await prisma.building.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, name: true } });
  if (existing && existing.id === p.buildingId) return { name: existing.name, changed: false, movedNotes: 0 };
  if (!existing && p.building && p.building._count.units === 1) {
    await prisma.building.update({ where: { id: p.building.id }, data: { name } });
    return { name, changed: true, movedNotes: 0 };
  }
  const to = existing ?? (await prisma.building.create({ data: { name }, select: { id: true, name: true } }));
  const movedNotes = await prisma.$transaction(async (tx) => {
    await tx.property.update({ where: { id: p.id }, data: { buildingId: to.id } });
    if (!p.buildingId || (await tx.property.count({ where: { buildingId: p.buildingId } })) > 0) return 0;
    const { count } = await tx.propertyNote.updateMany({ where: { buildingId: p.buildingId }, data: { buildingId: to.id } });
    await tx.building.delete({ where: { id: p.buildingId } });
    return count;
  });
  return { name: to.name, changed: true, movedNotes };
}

/** The building with this name (ignoring case and extra spaces), made if there isn't one. */
export async function buildingByName(name: string) {
  const clean = cleanName(name);
  const found = await prisma.building.findFirst({ where: { name: { equals: clean, mode: "insensitive" } }, select: { id: true, name: true } });
  return found ?? prisma.building.create({ data: { name: clean }, select: { id: true, name: true } });
}
