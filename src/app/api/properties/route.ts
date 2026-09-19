import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["BOSS", "ADMIN", "AGENT"].includes(user.role)) {
    return NextResponse.json({ success: false, message: "没有权限" }, { status: 403 });
  }

  const properties = await prisma.property.findMany({ orderBy: { name: "asc" } });

  // Room count and carpark count are tracked separately — a property's "房间数" must not
  // include its carpark slots, since those are a different kind of rentable unit.
  const roomGroups = await prisma.room.groupBy({
    by: ["propertyId"],
    where: { isCarpark: false },
    _count: { _all: true },
  });
  const carparkGroups = await prisma.room.groupBy({
    by: ["propertyId"],
    where: { isCarpark: true },
    _count: { _all: true },
  });
  const roomCountByPropertyId = new Map(roomGroups.map((g) => [g.propertyId, g._count._all]));
  const carparkCountByPropertyId = new Map(carparkGroups.map((g) => [g.propertyId, g._count._all]));

  return NextResponse.json({
    success: true,
    properties: properties.map((p) => ({
      propertyCode: p.propertyCode,
      name: p.name,
      address: p.address,
      region: p.region,
      landlord: p.landlord,
      managementFeeRate: p.managementFeeRate ? Number(p.managementFeeRate) : null,
      ownerRentalAmount: p.ownerRentalAmount ? Number(p.ownerRentalAmount) : null,
      ownerDeposit: p.ownerDeposit ? Number(p.ownerDeposit) : null,
      status: p.status,
      notes: p.notes,
      roomCount: roomCountByPropertyId.get(p.id) ?? 0,
      carparkCount: carparkCountByPropertyId.get(p.id) ?? 0,
    })),
  });
}

const createSchema = z.object({
  propertyCode: z.string().trim().min(1).toUpperCase(),
  name: z.string().trim().min(1),
  address: z.string().trim().optional().default(""),
  region: z.string().trim().optional().default(""),
  landlord: z.string().trim().optional().default(""),
  managementFeeRate: z.coerce.number().min(0).max(1).optional(),
  ownerRentalAmount: z.coerce.number().min(0).optional(),
  ownerDeposit: z.coerce.number().min(0).optional(),
  notes: z.string().trim().optional().default(""),
  roomCount: z.coerce.number().int().min(0).max(200).optional().default(0),
  carparkCount: z.coerce.number().int().min(0).max(200).optional().default(0),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "只有 Admin 可以建楼盘" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "楼盘代号和名字一定要填" }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.property.findUnique({ where: { propertyCode: d.propertyCode } });
  if (existing) {
    return NextResponse.json({ success: false, message: "这个楼盘代号已经有人用了" }, { status: 409 });
  }

  const property = await prisma.property.create({
    data: {
      propertyCode: d.propertyCode,
      name: d.name,
      address: d.address || null,
      region: d.region || null,
      landlord: d.landlord || null,
      // A unit is either managed-for-a-landlord-% or leased-from-owner-for-fixed-rent,
      // never both — owner rental (if given) wins.
      managementFeeRate: d.ownerRentalAmount ? null : d.managementFeeRate ?? null,
      ownerRentalAmount: d.ownerRentalAmount ?? null,
      ownerDeposit: d.ownerRentalAmount ? d.ownerDeposit ?? null : null,
      notes: d.notes || null,
    },
  });

  // Auto-fill rooms ({code}-01..N) and standalone carpark slots ({code}-CP01..M) — Admin
  // fills in rent/type details per room afterward via the room edit modal.
  for (let i = 1; i <= d.roomCount; i++) {
    await prisma.room.create({
      data: {
        roomCode: `${d.propertyCode}-${String(i).padStart(2, "0")}`,
        propertyId: property.id,
        propertyName: d.name,
        roomRental: 0,
        status: "VACANT",
      },
    });
  }
  for (let i = 1; i <= d.carparkCount; i++) {
    await prisma.room.create({
      data: {
        roomCode: `${d.propertyCode}-CP${String(i).padStart(2, "0")}`,
        propertyId: property.id,
        propertyName: d.name,
        roomType: "Carpark",
        roomRental: 0,
        isCarpark: true,
        status: "VACANT",
      },
    });
  }

  const extra =
    d.roomCount || d.carparkCount
      ? ` (自动加了 ${d.roomCount} 间房${d.carparkCount ? ` + ${d.carparkCount} 个车位` : ""})`
      : "";
  return NextResponse.json({ success: true, message: `✅ 楼盘已建: ${d.propertyCode} (${d.name})${extra}` });
}
