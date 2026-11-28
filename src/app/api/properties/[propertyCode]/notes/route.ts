import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { buildingChoices, canEditNotes, canReadNotes, notesForUnit, setUnitBuilding } from "@/lib/propertyNotes";

type Ctx = { params: Promise<{ propertyCode: string }> };

/** GET — this unit's 注意事项 and its building's (Boss, Admin, Agent). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canReadNotes(user)) return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  const { propertyCode } = await params;
  const data = await notesForUnit(propertyCode);
  if (!data) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });
  const canEdit = canEditNotes(user);
  return NextResponse.json({
    success: true,
    unit: data.unit,
    building: data.building,
    buildingNotes: data.buildingNotes,
    unitNotes: data.unitNotes,
    canEdit,
    buildings: canEdit ? await buildingChoices() : [],
  });
}

const noteSchema = z.object({
  scope: z.enum(["UNIT", "BUILDING"]),
  text: z.string().trim().min(1, "请写要注意什么").max(1000),
});

/** POST — add a note to this unit, or to its whole building (Boss, Admin). */
async function handlePOST(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canEditNotes(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以写注意事项" }, { status: 403 });
  const { propertyCode } = await params;
  const parsed = noteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  const p = await prisma.property.findUnique({ where: { propertyCode }, select: { id: true, buildingId: true, building: { select: { name: true } } } });
  if (!p) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });
  if (parsed.data.scope === "BUILDING" && !p.buildingId) {
    return NextResponse.json({ success: false, message: "先设定这个单位属于哪栋 condo / apartment" }, { status: 400 });
  }
  await prisma.propertyNote.create({
    data: {
      text: parsed.data.text,
      createdByName: user.name,
      ...(parsed.data.scope === "BUILDING" ? { buildingId: p.buildingId } : { propertyId: p.id }),
    },
  });
  return NextResponse.json({
    success: true,
    message: parsed.data.scope === "BUILDING" ? `已加到整栋 ${p.building?.name}` : `已加到 ${propertyCode}`,
  });
}

const buildingSchema = z.union([z.object({ buildingId: z.string().min(1) }), z.object({ name: z.string().trim().min(1, "请写 condo / apartment 的名字").max(120) })]);

/** PUT — which condo / apartment this unit is in: an existing one, or a new one by name (Boss, Admin).
 * Nothing written down gets lost: a building left with no units hands its notes to the new one. */
async function handlePUT(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canEditNotes(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以改" }, { status: 403 });
  const { propertyCode } = await params;
  const parsed = buildingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  const p = await prisma.property.findUnique({ where: { propertyCode }, select: { id: true } });
  if (!p) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  let name: string;
  if ("buildingId" in parsed.data) {
    const b = await prisma.building.findUnique({ where: { id: parsed.data.buildingId }, select: { name: true } });
    if (!b) return NextResponse.json({ success: false, message: "找不到这栋 condo / apartment" }, { status: 404 });
    name = b.name;
  } else name = parsed.data.name;

  const r = await setUnitBuilding(p.id, name);
  if (!r.changed) return NextResponse.json({ success: true, message: "没有改变" });
  return NextResponse.json({
    success: true,
    message: r.movedNotes
      ? `${propertyCode} 现在属于 ${r.name}（原本那栋的 ${r.movedNotes} 条注意事项也搬过去了）`
      : `${propertyCode} 现在属于 ${r.name}`,
  });
}

export const POST = withActivity(handlePOST);
export const PUT = withActivity(handlePUT);
