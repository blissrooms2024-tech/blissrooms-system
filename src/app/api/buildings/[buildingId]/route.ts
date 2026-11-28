import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { canEditNotes, cleanName } from "@/lib/propertyNotes";

type Ctx = { params: Promise<{ buildingId: string }> };

const schema = z.object({ name: z.string().trim().min(1, "请写名字").max(120) });

/** PATCH — rename a condo / apartment; every unit in it shows the new name (Boss, Admin). */
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || !canEditNotes(user)) return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以改" }, { status: 403 });
  const { buildingId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "资料不对" }, { status: 400 });
  const name = cleanName(parsed.data.name);
  const b = await prisma.building.findUnique({ where: { id: buildingId }, select: { id: true } });
  if (!b) return NextResponse.json({ success: false, message: "找不到这栋 condo / apartment" }, { status: 404 });
  const clash = await prisma.building.findFirst({ where: { id: { not: buildingId }, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (clash) {
    return NextResponse.json(
      { success: false, message: `已经有一栋叫「${name}」。要合在一起的话，请在单位里改选那一栋。` },
      { status: 409 }
    );
  }
  await prisma.building.update({ where: { id: buildingId }, data: { name } });
  return NextResponse.json({ success: true, message: `已改名为 ${name}` });
}

export const PATCH = withActivity(handlePATCH);
