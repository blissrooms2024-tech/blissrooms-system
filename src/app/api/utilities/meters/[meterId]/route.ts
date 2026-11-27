import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { unitRooms } from "@/lib/utilityBilling";
import { meterPatchSchema } from "@/lib/utilitySchemas";
import { KIND_LABELS, type UtilityKind } from "@/lib/utilitySplit";

type Ctx = { params: Promise<{ meterId: string }> };

async function load(meterId: string) {
  return prisma.utilityMeter.findUnique({
    where: { id: meterId },
    include: { property: { select: { id: true, propertyCode: true, name: true } }, room: { select: { roomCode: true } }, _count: { select: { readings: true } } },
  });
}

/** PATCH — change a meter's room, name, meter no., input mode, starting reading or start month
 * (Admin). The start month is fixed once the meter has been billed. */
async function handlePATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以改电表" }, { status: 403 });
  const { meterId } = await params;
  const meter = await load(meterId);
  if (!meter) return NextResponse.json({ success: false, message: "找不到这个电表" }, { status: 404 });
  const parsed = meterPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "电表资料不对" }, { status: 400 });
  const d = parsed.data;
  if (d.roomId) {
    const rooms = await unitRooms(meter.property);
    if (!rooms.some((r) => r.id === d.roomId)) return NextResponse.json({ success: false, message: "这个房间不在这个单位" }, { status: 400 });
  }
  if (d.startPeriod !== undefined && meter._count.readings > 0) {
    return NextResponse.json({ success: false, message: "这个电表已经开过账单，不能改开始月份" }, { status: 400 });
  }
  await prisma.utilityMeter.update({
    where: { id: meterId },
    data: {
      ...(d.roomId !== undefined ? { roomId: d.roomId } : {}),
      ...(d.label !== undefined ? { label: d.label || null } : {}),
      ...(d.meterNo !== undefined ? { meterNo: d.meterNo || null } : {}),
      ...(d.inputMode ? { inputMode: d.inputMode } : {}),
      ...(d.startReading !== undefined ? { startReading: d.startReading } : {}),
      ...(d.startPeriod !== undefined ? { startPeriod: d.startPeriod } : {}),
    },
  });
  return NextResponse.json({ success: true, message: `已更新 ${meter.property.propertyCode} ${KIND_LABELS[meter.kind as UtilityKind]?.zh ?? meter.kind}电表` });
}

/** DELETE — remove a meter. One that has already been billed is only switched off, so past
 * bills keep their readings. */
async function handleDELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以删电表" }, { status: 403 });
  const { meterId } = await params;
  const meter = await load(meterId);
  if (!meter) return NextResponse.json({ success: false, message: "找不到这个电表" }, { status: 404 });
  const name = `${meter.property.propertyCode} ${KIND_LABELS[meter.kind as UtilityKind]?.zh ?? meter.kind}电表（${meter.room?.roomCode ?? "整个单位"}）`;
  if (meter._count.readings > 0) {
    await prisma.utilityMeter.update({ where: { id: meterId }, data: { active: false } });
    return NextResponse.json({ success: true, message: `已停用${name}，以前的账单记录保留` });
  }
  await prisma.utilityMeter.delete({ where: { id: meterId } });
  return NextResponse.json({ success: true, message: `已删除${name}` });
}

export const PATCH = withActivity(handlePATCH);
export const DELETE = withActivity(handleDELETE);
