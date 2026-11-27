import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { withActivity } from "@/lib/activity";
import { findUnit, unitRooms } from "@/lib/utilityBilling";
import { meterSchema } from "@/lib/utilitySchemas";
import { KIND_LABELS, type UtilityKind } from "@/lib/utilitySplit";

/** POST /api/utilities/PXC/meters — register a meter for the unit (Admin). */
async function handlePOST(req: NextRequest, { params }: { params: Promise<{ propertyCode: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ success: false, message: "只有 Admin 可以登记电表" }, { status: 403 });
  const { propertyCode } = await params;
  const unit = await findUnit(propertyCode);
  if (!unit) return NextResponse.json({ success: false, message: "找不到这个单位" }, { status: 404 });

  const parsed = meterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "电表资料不完整" }, { status: 400 });
  const d = parsed.data;
  if (d.roomId) {
    const rooms = await unitRooms(unit);
    if (!rooms.some((r) => r.id === d.roomId)) return NextResponse.json({ success: false, message: "这个房间不在这个单位" }, { status: 400 });
  }
  if (d.inputMode === "READING" && (d.startReading === null || d.startReading === undefined)) {
    return NextResponse.json({ success: false, message: "抄读数的电表要填现在的读数（第一次开单从这个读数算起）" }, { status: 400 });
  }

  const meter = await prisma.utilityMeter.create({
    data: {
      propertyId: unit.id,
      kind: d.kind,
      roomId: d.roomId,
      label: d.label || null,
      meterNo: d.meterNo || null,
      inputMode: d.inputMode,
      startReading: d.inputMode === "READING" ? d.startReading : null,
    },
    include: { room: { select: { roomCode: true } } },
  });
  const where = meter.room?.roomCode ?? "整个单位";
  return NextResponse.json({ success: true, message: `已登记 ${unit.propertyCode} ${KIND_LABELS[d.kind as UtilityKind].zh}电表（${where}）`, id: meter.id });
}

export const POST = withActivity(handlePOST);
