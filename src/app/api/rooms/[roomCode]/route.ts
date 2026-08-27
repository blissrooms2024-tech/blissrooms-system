import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const patchSchema = z
  .object({
    status: z.enum(["VACANT", "OCCUPIED", "RESERVED", "MAINTENANCE"]).optional(),
    hasAircon: z.boolean().optional(),
    roomType: z.string().trim().optional(),
    roomRental: z.coerce.number().min(0).optional(),
    carparkRental: z.coerce.number().min(0).optional(),
    notes: z.string().trim().optional(),
    photoLink: z.string().trim().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "没有要改的东西" });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以改" }, { status: 403 });
  }
  const { roomCode } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "资料不对" }, { status: 400 });
  }

  const existing = await prisma.room.findUnique({ where: { roomCode } });
  if (!existing) {
    return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });
  }

  const d = parsed.data;
  const data: {
    status?: typeof d.status;
    hasAircon?: boolean;
    roomType?: string;
    roomRental?: number;
    carparkRental?: number;
    notes?: string;
    photoLink?: string | null;
  } = {};
  if (d.status !== undefined) data.status = d.status;
  if (d.hasAircon !== undefined) data.hasAircon = d.hasAircon;
  if (d.roomType !== undefined) data.roomType = d.roomType;
  if (d.roomRental !== undefined) data.roomRental = d.roomRental;
  if (d.carparkRental !== undefined) data.carparkRental = d.carparkRental;
  if (d.notes !== undefined) data.notes = d.notes;
  if (d.photoLink !== undefined) data.photoLink = d.photoLink || null;
  await prisma.room.update({ where: { roomCode }, data });

  return NextResponse.json({ success: true, message: `✅ ${roomCode} 已更新` });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以删除" }, { status: 403 });
  }
  const { roomCode } = await params;
  const existing = await prisma.room.findUnique({ where: { roomCode } });
  if (!existing) {
    return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });
  }

  const contractCount = await prisma.contract.count({ where: { roomId: existing.id } });
  if (contractCount > 0 || existing.currentTenantId) {
    return NextResponse.json(
      { success: false, message: "这间房有关联的合同记录，不能删除" },
      { status: 409 }
    );
  }

  await prisma.room.delete({ where: { roomCode } });

  return NextResponse.json({ success: true, message: `✅ ${roomCode} 已删除` });
}
