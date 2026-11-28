import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { setUnitBuilding } from "@/lib/propertyNotes";

const schema = z.object({
  units: z
    .array(
      z.object({
        propertyCode: z.string().min(1).max(40),
        building: z.string().trim().max(80),
        unitNo: z.string().trim().max(40),
      })
    )
    .min(1)
    .max(300),
});

/**
 * PUT /api/properties/placement — set many units' 楼盘 (condo) and 单位号码 at once, for the
 * 楼盘 → 单位号码 → 房间 dropdowns. Boss / Admin. Rows go one by one, in order, so two units
 * named into the same new condo end up together.
 */
async function handlePUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "BOSS")) {
    return NextResponse.json({ success: false, message: "只有 Boss / Admin 可以改" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "资料格式不对" }, { status: 400 });

  let changed = 0;
  const missing: string[] = [];
  for (const row of parsed.data.units) {
    const p = await prisma.property.findUnique({
      where: { propertyCode: row.propertyCode },
      select: { id: true, info: { select: { unitNo: true } } },
    });
    if (!p) {
      missing.push(row.propertyCode);
      continue;
    }
    let touched = false;
    if (row.building) touched = (await setUnitBuilding(p.id, row.building)).changed || touched;
    const unitNo = row.unitNo || null;
    if ((p.info?.unitNo ?? null) !== unitNo) {
      await prisma.propertyInfo.upsert({ where: { propertyId: p.id }, create: { propertyId: p.id, unitNo }, update: { unitNo } });
      touched = true;
    }
    if (touched) changed++;
  }
  return NextResponse.json({
    success: true,
    changed,
    message: changed
      ? `已更新 ${changed} 个单位的楼盘 / 单位号码${missing.length ? `（找不到：${missing.join("、")}）` : ""}`
      : "没有改变",
  });
}

export const PUT = withActivity(handlePUT);
