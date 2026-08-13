import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ propertyCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }
  const { propertyCode } = await params;
  const property = await prisma.property.findUnique({
    where: { propertyCode },
    include: { rooms: { select: { roomCode: true, roomType: true, status: true } } },
  });
  if (!property) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  return NextResponse.json({
    success: true,
    property: {
      propertyCode: property.propertyCode,
      name: property.name,
      address: property.address,
      region: property.region,
      landlord: property.landlord,
      managementFeeRate: property.managementFeeRate ? Number(property.managementFeeRate) : null,
      status: property.status,
      notes: property.notes,
      rooms: property.rooms,
    },
  });
}

const editSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().optional().default(""),
  region: z.string().trim().optional().default(""),
  landlord: z.string().trim().optional().default(""),
  managementFeeRate: z.coerce.number().min(0).max(1).optional(),
  status: z.string().trim().optional().default("Active"),
  notes: z.string().trim().optional().default(""),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ propertyCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以编辑" }, { status: 403 });
  }
  const { propertyCode } = await params;
  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "楼盘名字一定要填" }, { status: 400 });
  }
  const existing = await prisma.property.findUnique({ where: { propertyCode } });
  if (!existing) return NextResponse.json({ success: false, message: "找不到这个楼盘" }, { status: 404 });

  const d = parsed.data;
  await prisma.property.update({
    where: { propertyCode },
    data: {
      name: d.name,
      address: d.address || null,
      region: d.region || null,
      landlord: d.landlord || null,
      managementFeeRate: d.managementFeeRate ?? null,
      status: d.status,
      notes: d.notes || null,
    },
  });

  if (d.name !== existing.name) {
    await prisma.room.updateMany({ where: { propertyId: existing.id }, data: { propertyName: d.name } });
  }

  return NextResponse.json({ success: true, message: `✅ 楼盘已更新: ${d.name}` });
}
