import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const { roomCode } = await params;
  const room = await prisma.room.findUnique({
    where: { roomCode },
    include: { property: { select: { propertyCode: true } }, currentTenant: { select: { name: true, email: true, phone: true } } },
  });
  if (!room) return NextResponse.json({ success: false, message: "找不到这间房" }, { status: 404 });

  const contracts = await prisma.contract.findMany({
    where: { OR: [{ roomId: room.id }, { carparkRoomId: room.id }] },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    room: serialize({
      roomCode: room.roomCode,
      propertyCode: room.property?.propertyCode ?? null,
      propertyName: room.propertyName,
      roomType: room.roomType,
      roomRental: room.roomRental,
      carparkRental: room.carparkRental,
      securityDeposit: room.securityDeposit,
      carparkLotNumber: room.carparkLotNumber,
      hasAircon: room.hasAircon,
      isCarpark: room.isCarpark,
      status: room.status,
      notes: room.notes,
      photoLink: room.photoLink,
      currentTenant: room.currentTenant,
    }),
    contracts: serialize(
      contracts.map((c) => ({
        contractCode: c.contractCode,
        tenantName: c.tenantName,
        agentName: c.agentName,
        status: c.status,
        moveInDate: c.moveInDate,
        expiredDate: c.expiredDate,
        totalOutstanding: c.totalOutstanding,
        createdAt: c.createdAt,
      }))
    ),
  });
}

const patchSchema = z
  .object({
    roomCode: z.string().trim().min(1).toUpperCase().optional(),
    status: z.enum(["VACANT", "OCCUPIED", "RESERVED", "MAINTENANCE", "STORE"]).optional(),
    hasAircon: z.boolean().optional(),
    isCarpark: z.boolean().optional(),
    roomType: z.string().trim().optional(),
    roomRental: z.coerce.number().min(0).optional(),
    carparkRental: z.coerce.number().min(0).optional(),
    securityDeposit: z.coerce.number().min(0).optional(),
    carparkLotNumber: z.string().trim().optional(),
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

  if (d.roomCode !== undefined && d.roomCode !== existing.roomCode) {
    const dup = await prisma.room.findUnique({ where: { roomCode: d.roomCode } });
    if (dup) {
      return NextResponse.json({ success: false, message: "这个 Room Code 已经有人用了" }, { status: 409 });
    }
  }

  const data: {
    roomCode?: string;
    status?: typeof d.status;
    hasAircon?: boolean;
    isCarpark?: boolean;
    roomType?: string;
    roomRental?: number;
    carparkRental?: number;
    securityDeposit?: number;
    carparkLotNumber?: string | null;
    notes?: string;
    photoLink?: string | null;
  } = {};
  if (d.roomCode !== undefined) data.roomCode = d.roomCode;
  if (d.status !== undefined) data.status = d.status;
  if (d.hasAircon !== undefined) data.hasAircon = d.hasAircon;
  if (d.isCarpark !== undefined) data.isCarpark = d.isCarpark;
  if (d.roomType !== undefined) data.roomType = d.roomType;
  if (d.roomRental !== undefined) data.roomRental = d.roomRental;
  if (d.carparkRental !== undefined) data.carparkRental = d.carparkRental;
  if (d.securityDeposit !== undefined) data.securityDeposit = d.securityDeposit;
  if (d.carparkLotNumber !== undefined) data.carparkLotNumber = d.carparkLotNumber || null;
  if (d.notes !== undefined) data.notes = d.notes;
  if (d.photoLink !== undefined) data.photoLink = d.photoLink || null;
  await prisma.room.update({ where: { roomCode }, data });

  return NextResponse.json({ success: true, message: `✅ ${d.roomCode ?? roomCode} 已更新`, roomCode: d.roomCode ?? roomCode });
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

  const contractCount = await prisma.contract.count({
    where: { OR: [{ roomId: existing.id }, { carparkRoomId: existing.id }] },
  });
  if (contractCount > 0 || existing.currentTenantId) {
    return NextResponse.json(
      { success: false, message: "这间房有关联的合同记录，不能删除" },
      { status: 409 }
    );
  }

  await prisma.room.delete({ where: { roomCode } });

  return NextResponse.json({ success: true, message: `✅ ${roomCode} 已删除` });
}
